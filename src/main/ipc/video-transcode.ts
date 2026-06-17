import { app, dialog, ipcMain, protocol } from 'electron'
import { randomUUID } from 'crypto'
import { spawn, type ChildProcess } from 'child_process'
import { constants as fsConstants, promises as fs } from 'fs'
import { basename, dirname, extname, isAbsolute, join } from 'path'
import { Readable } from 'stream'
import { isValidNativeFileId } from '../../shared/native-media'
import type {
  FfmpegCapabilityInfo,
  FfmpegConfigInfo,
  FfmpegConfigStatus,
  VideoLiveTranscodeStartRequest,
  VideoLiveTranscodeStartResult,
  VideoPosterRequest,
  VideoPosterResult,
  VideoProbeRequest,
  VideoProbeResult,
  VideoTranscodeRunRequest,
  VideoTranscodeRunResult
} from '../../shared/ipc-channels'
import {
  DEFAULT_VIDEO_TRANSCODE_PROFILE,
  getVideoRateControl,
  normalizeVideoTranscodeProfile,
  type H264EncoderName,
  type VideoTranscodeProfile,
  type VideoTranscodeSourceMetadata
} from '../../shared/video-transcode-profile'
import type { WindowManager } from '../windowManager'
import { getNativeFilePath } from './native-fs'
import { isMainWindow } from './validate'

interface StoredFfmpegConfig {
  executablePath: string
  executableName: string
  version: string
  ffprobePath?: string
  ffprobeExecutableName?: string
  ffprobeVersion?: string
  capabilities: FfmpegCapabilityInfo
  validatedAt: number
}

const CONFIG_FILE_NAME = 'ffmpeg-config.json'
const VALIDATION_TIMEOUT_MS = 5000
const MAX_PROCESS_OUTPUT_LENGTH = 1024 * 1024
const WINDOWS_EXECUTABLE_EXTENSIONS = new Set(['.exe', '.cmd', '.bat'])
const activeTranscodes = new Map<string, { child: ChildProcess; temporaryPath: string }>()
const activeLiveTranscodes = new Map<string, { child: ChildProcess; stderr: string }>()

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME)
}

function toInfo(config: StoredFfmpegConfig): FfmpegConfigInfo {
  return {
    status: 'ready',
    source: 'stored',
    executableName: config.executableName,
    version: config.version,
    ffprobeExecutableName: config.ffprobeExecutableName,
    ffprobeVersion: config.ffprobeVersion,
    capabilities: config.capabilities,
    validatedAt: config.validatedAt
  }
}

async function readStoredConfig(): Promise<StoredFfmpegConfig | null> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredFfmpegConfig>
    if (
      typeof parsed.executablePath !== 'string' ||
      typeof parsed.executableName !== 'string' ||
      typeof parsed.version !== 'string' ||
      typeof parsed.validatedAt !== 'number' ||
      typeof parsed.capabilities !== 'object' ||
      parsed.capabilities === null
    ) {
      return null
    }
    return parsed as StoredFfmpegConfig
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    return null
  }
}

async function writeStoredConfig(config: StoredFfmpegConfig): Promise<void> {
  const configPath = getConfigPath()
  const temporaryPath = `${configPath}.${process.pid}.tmp`
  await fs.mkdir(dirname(configPath), { recursive: true })
  await fs.writeFile(temporaryPath, JSON.stringify(config, null, 2), 'utf8')
  await fs.rename(temporaryPath, configPath)
}

async function removeStoredConfig(): Promise<void> {
  await fs.rm(getConfigPath(), { force: true })
}

function createInfo(status: FfmpegConfigStatus, message: string): FfmpegConfigInfo {
  return { status, message, validatedAt: Date.now() }
}

function runExecutable(executablePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    if (!child?.stdout || !child.stderr) {
      reject(new Error('FFmpeg process did not expose stdout or stderr'))
      return
    }
    let output = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('FFmpeg validation timed out'))
    }, VALIDATION_TIMEOUT_MS)

    const append = (chunk: Buffer): void => {
      if (output.length < MAX_PROCESS_OUTPUT_LENGTH) output += chunk.toString('utf8')
    }

    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(`FFmpeg exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

function runTranscodeProcess(
  jobId: string,
  executablePath: string,
  args: string[],
  temporaryPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (activeTranscodes.has(jobId)) {
      reject(new Error('Transcode job is already running'))
      return
    }

    const child = spawn(executablePath, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    if (!child?.stdout || !child.stderr) {
      reject(new Error('FFmpeg process did not expose stdout or stderr'))
      return
    }
    activeTranscodes.set(jobId, { child, temporaryPath })
    let stderr = ''

    const appendError = (chunk: Buffer): void => {
      if (stderr.length < MAX_PROCESS_OUTPUT_LENGTH) stderr += chunk.toString('utf8')
    }

    child.stdout.on('data', () => undefined)
    child.stderr.on('data', appendError)
    child.on('error', (error) => {
      activeTranscodes.delete(jobId)
      console.error('[video-transcode] FFmpeg process failed to start', {
        jobId,
        error: error.message
      })
      reject(error)
    })
    child.on('close', (code) => {
      activeTranscodes.delete(jobId)
      if (code === 0) {
        resolve()
      } else {
        const message = stderr.trim() || `FFmpeg exited with code ${code ?? 'unknown'}`
        console.error('[video-transcode] FFmpeg process failed', {
          jobId,
          code,
          error: message.split('\n').at(-1)
        })
        reject(new Error(message))
      }
    })
  })
}

function parseVersion(output: string): string | null {
  const match = output.match(/ff(?:mpeg|probe) version\s+([^\s]+)/i)
  return match?.[1] ?? null
}

function parseCapabilities(encoders: string, muxers: string): FfmpegCapabilityInfo {
  const supportedH264Encoders: H264EncoderName[] = [
    'h264_videotoolbox',
    'h264_nvenc',
    'h264_qsv',
    'h264_amf',
    'libx264'
  ]
  const h264Encoders = supportedH264Encoders.filter((encoder) =>
    new RegExp(`^\\s*V\\S*\\s+${encoder}\\b`, 'm').test(encoders)
  )
  return {
    hasH264Encoder: h264Encoders.length > 0,
    hasAacEncoder: /^\s*A\S*\s+aac\b/m.test(encoders),
    hasMp4Muxer: /^\s*E\s+mp4\b/m.test(muxers),
    h264Encoders
  }
}

async function validateFfprobePath(
  executablePath: string,
  executableName: string
): Promise<{ path: string; name: string; version: string } | null> {
  try {
    const versionOutput = await runExecutable(executablePath, ['-version'])
    const version = parseVersion(versionOutput)
    return version ? { path: executablePath, name: executableName, version } : null
  } catch {
    return null
  }
}

async function findFfprobeForFfmpeg(ffmpegPath: string): Promise<{
  path: string
  name: string
  version: string
} | null> {
  const siblingName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const siblingPath = isAbsolute(ffmpegPath) ? join(dirname(ffmpegPath), siblingName) : siblingName
  const sibling = await validateFfprobePath(siblingPath, siblingName)
  if (sibling) return sibling
  if (!isAbsolute(ffmpegPath)) return validateFfprobePath('ffprobe', 'ffprobe')
  return null
}

async function validateRunnable(
  executablePath: string,
  executableName: string,
  source: 'stored' | 'system' = 'stored',
  detectFfprobe = true
): Promise<{
  info: FfmpegConfigInfo
  stored?: StoredFfmpegConfig
}> {
  try {
    const versionOutput = await runExecutable(executablePath, ['-version'])
    const version = parseVersion(versionOutput)
    if (!version)
      return { info: createInfo('unsupported-version', 'Unable to detect FFmpeg version') }

    const [encoders, muxers] = await Promise.all([
      runExecutable(executablePath, ['-hide_banner', '-encoders']),
      runExecutable(executablePath, ['-hide_banner', '-muxers'])
    ])
    const capabilities = parseCapabilities(encoders, muxers)
    if (!capabilities.hasH264Encoder || !capabilities.hasAacEncoder || !capabilities.hasMp4Muxer) {
      return {
        info: {
          status: 'invalid',
          source,
          executableName,
          version,
          capabilities,
          message: 'FFmpeg is missing required H.264, AAC, or MP4 capabilities',
          validatedAt: Date.now()
        }
      }
    }

    const ffprobe = detectFfprobe ? await findFfprobeForFfmpeg(executablePath) : null
    const stored: StoredFfmpegConfig = {
      executablePath,
      executableName,
      version,
      ffprobePath: ffprobe?.path,
      ffprobeExecutableName: ffprobe?.name,
      ffprobeVersion: ffprobe?.version,
      capabilities,
      validatedAt: Date.now()
    }
    return { info: { ...toInfo(stored), source }, stored }
  } catch (error) {
    return {
      info: createInfo(
        'invalid',
        error instanceof Error ? error.message : 'FFmpeg validation failed'
      )
    }
  }
}

async function validateExecutablePath(
  executablePath: unknown,
  detectFfprobe = true
): Promise<{
  info: FfmpegConfigInfo
  stored?: StoredFfmpegConfig
}> {
  if (typeof executablePath !== 'string' || !isAbsolute(executablePath)) {
    return { info: createInfo('invalid', 'Selected FFmpeg path is invalid') }
  }

  let resolvedPath: string
  try {
    resolvedPath = await fs.realpath(executablePath)
    const stat = await fs.stat(resolvedPath)
    if (!stat.isFile()) return { info: createInfo('invalid', 'Selected FFmpeg path is not a file') }
    if (process.platform === 'win32') {
      if (!WINDOWS_EXECUTABLE_EXTENSIONS.has(extname(resolvedPath).toLowerCase())) {
        return { info: createInfo('invalid', 'Selected FFmpeg file is not executable') }
      }
    } else {
      await fs.access(resolvedPath, fsConstants.X_OK)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { info: createInfo('missing', 'Selected FFmpeg executable is missing') }
    }
    return { info: createInfo('invalid', 'Selected FFmpeg executable cannot be used') }
  }

  return validateRunnable(resolvedPath, basename(resolvedPath), 'stored', detectFfprobe)
}

async function validateFfprobeExecutablePath(executablePath: unknown): Promise<{
  info: FfmpegConfigInfo
  stored?: StoredFfmpegConfig
}> {
  const stored = (await readStoredConfig()) ?? (await detectSystemFfmpeg())
  if (!stored) return { info: createInfo('not-configured', 'FFmpeg is not configured') }
  if (typeof executablePath !== 'string' || !isAbsolute(executablePath)) {
    return { info: createInfo('invalid', 'Selected FFprobe path is invalid') }
  }

  try {
    const resolvedPath = await fs.realpath(executablePath)
    const stat = await fs.stat(resolvedPath)
    if (!stat.isFile()) return { info: createInfo('invalid', 'Selected FFprobe path is not a file') }
    if (process.platform !== 'win32') await fs.access(resolvedPath, fsConstants.X_OK)
    const ffprobe = await validateFfprobePath(resolvedPath, basename(resolvedPath))
    if (!ffprobe) return { info: createInfo('invalid', 'Selected FFprobe executable cannot be used') }
    const next: StoredFfmpegConfig = {
      ...stored,
      ffprobePath: ffprobe.path,
      ffprobeExecutableName: ffprobe.name,
      ffprobeVersion: ffprobe.version,
      validatedAt: Date.now()
    }
    return { info: toInfo(next), stored: next }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { info: createInfo('missing', 'Selected FFprobe executable is missing') }
    }
    return { info: createInfo('invalid', 'Selected FFprobe executable cannot be used') }
  }
}

async function detectSystemFfmpeg(): Promise<StoredFfmpegConfig | null> {
  const validation = await validateRunnable('ffmpeg', 'ffmpeg', 'system')
  return validation.info.status === 'ready' && validation.stored ? validation.stored : null
}

async function readReadyConfig(): Promise<StoredFfmpegConfig | null> {
  const stored = await readStoredConfig()
  if (stored) {
    const validation = await validateExecutablePath(stored.executablePath, false)
    if (validation.stored) {
      let next = validation.stored
      if (stored.ffprobePath && !next.ffprobePath) {
        const ffprobe = await validateFfprobePath(
          stored.ffprobePath,
          stored.ffprobeExecutableName ?? basename(stored.ffprobePath)
        )
        if (ffprobe) {
          next = {
            ...next,
            ffprobePath: ffprobe.path,
            ffprobeExecutableName: ffprobe.name,
            ffprobeVersion: ffprobe.version
          }
        }
      }
      await writeStoredConfig(next)
      return next
    }
  }

  return detectSystemFfmpeg()
}

async function readReadyConfigForTranscode(): Promise<StoredFfmpegConfig> {
  const config = await readReadyConfig()
  if (!config) throw new Error('FFmpeg is not configured')
  return config
}

function normalizeSourceMetadata(value: unknown): VideoTranscodeSourceMetadata | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  const readNumber = (key: string): number | undefined =>
    typeof record[key] === 'number' && Number.isFinite(record[key])
      ? Math.max(0, record[key] as number)
      : undefined

  return {
    width: readNumber('width'),
    height: readNumber('height'),
    durationMs: readNumber('durationMs'),
    container: typeof record.container === 'string' ? record.container : undefined,
    videoCodec: typeof record.videoCodec === 'string' ? record.videoCodec : undefined,
    audioCodec: typeof record.audioCodec === 'string' ? record.audioCodec : undefined,
    frameRate: readNumber('frameRate')
  }
}

function getPreferredH264Encoder(config: StoredFfmpegConfig, forceCpu = false): H264EncoderName {
  const encoders = config.capabilities.h264Encoders ?? []
  if (forceCpu || encoders.length === 0) return 'libx264'
  const platformPreference: H264EncoderName[] =
    process.platform === 'darwin'
      ? ['h264_videotoolbox', 'libx264']
      : process.platform === 'win32'
        ? ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264']
        : ['h264_nvenc', 'h264_qsv', 'libx264']
  return platformPreference.find((encoder) => encoders.includes(encoder)) ?? 'libx264'
}

function createScaleFilter(targetHeight: number, sourceHeight?: number): string | null {
  if (sourceHeight && sourceHeight <= targetHeight) return null
  return `scale=if(gt(ih\\,${targetHeight})\\,-2\\,iw):if(gt(ih\\,${targetHeight})\\,${targetHeight}\\,ih)`
}

function buildTranscodeArgs(input: {
  sourcePath: string
  output: string
  profile?: VideoTranscodeProfile
  sourceMetadata?: VideoTranscodeSourceMetadata
  encoder: H264EncoderName
  mode: 'background' | 'live'
}): string[] {
  const profile = normalizeVideoTranscodeProfile(input.profile ?? DEFAULT_VIDEO_TRANSCODE_PROFILE)
  const rateControl = getVideoRateControl({
    sourceHeight: input.sourceMetadata?.height,
    profile
  })
  const scaleFilter = createScaleFilter(rateControl.targetHeight, input.sourceMetadata?.height)
  const args = [
    '-hide_banner',
    ...(input.mode === 'background' ? ['-y'] : ['-loglevel', 'error']),
    '-i',
    input.sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-c:v',
    input.encoder,
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    `${rateControl.bitrateKbps}k`,
    '-maxrate',
    `${rateControl.maxrateKbps}k`,
    '-bufsize',
    `${rateControl.bufsizeKbps}k`
  ]
  if (scaleFilter) args.push('-vf', scaleFilter)
  if (input.mode === 'background' && input.sourceMetadata?.audioCodec?.toLowerCase() === 'aac') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', 'aac')
  }
  args.push(
    '-movflags',
    input.mode === 'background' ? '+faststart' : 'frag_keyframe+empty_moov+default_base_moof',
    '-f',
    'mp4',
    input.output
  )
  return args
}

function validateRunRequest(input: unknown): VideoTranscodeRunRequest {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid transcode request')
  const request = input as Partial<VideoTranscodeRunRequest>
  if (typeof request.jobId !== 'string' || request.jobId.length === 0) {
    throw new Error('Invalid transcode job id')
  }
  if (!isValidNativeFileId(request.sourceFileId)) throw new Error('Invalid transcode source id')
  if (!isValidNativeFileId(request.outputFileId)) throw new Error('Invalid transcode output id')
  if (request.sourceFileId === request.outputFileId) {
    throw new Error('Transcode source and output ids must differ')
  }
  return {
    jobId: request.jobId,
    sourceFileId: request.sourceFileId,
    outputFileId: request.outputFileId,
    profile: normalizeVideoTranscodeProfile(request.profile),
    sourceMetadata: normalizeSourceMetadata(request.sourceMetadata)
  }
}

async function runTranscode(input: unknown): Promise<VideoTranscodeRunResult> {
  const request = validateRunRequest(input)
  const config = await readReadyConfigForTranscode()
  const sourcePath = getNativeFilePath(request.sourceFileId)
  const outputPath = getNativeFilePath(request.outputFileId)
  const temporaryPath = join(
    dirname(outputPath),
    `.${request.outputFileId}.${randomUUID()}.tmp.mp4`
  )

  await fs.mkdir(dirname(outputPath), { recursive: true })
  const encoder = getPreferredH264Encoder(config)
  const createArgs = (selectedEncoder: H264EncoderName): string[] =>
    buildTranscodeArgs({
      sourcePath,
      output: temporaryPath,
      profile: request.profile,
      sourceMetadata: request.sourceMetadata,
      encoder: selectedEncoder,
      mode: 'background'
    })

  try {
    try {
      await runTranscodeProcess(request.jobId, config.executablePath, createArgs(encoder), temporaryPath)
    } catch (error) {
      const canRetryCpu =
        encoder !== 'libx264' && (config.capabilities.h264Encoders ?? []).includes('libx264')
      if (!canRetryCpu) throw error
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
      console.warn('[video-transcode] Retrying transcode with CPU encoder', {
        jobId: request.jobId,
        failedEncoder: encoder
      })
      await runTranscodeProcess(
        request.jobId,
        config.executablePath,
        createArgs('libx264'),
        temporaryPath
      )
    }
    const stat = await fs.stat(temporaryPath)
    if (!stat.isFile() || stat.size <= 0) throw new Error('Transcoded output is empty')
    await fs.rename(temporaryPath, outputPath)
    return { outputFileId: request.outputFileId, size: stat.size }
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

function validatePosterRequest(input: unknown): VideoPosterRequest {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid poster request')
  const request = input as Partial<VideoPosterRequest>
  if (!isValidNativeFileId(request.sourceFileId)) throw new Error('Invalid poster source id')
  return { sourceFileId: request.sourceFileId }
}

function validateProbeRequest(input: unknown): VideoProbeRequest {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid probe request')
  const request = input as Partial<VideoProbeRequest>
  if (!isValidNativeFileId(request.sourceFileId)) throw new Error('Invalid probe source id')
  return { sourceFileId: request.sourceFileId }
}

function parseFrameRate(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.includes('/')) return undefined
  const [numerator, denominator] = value.split('/').map(Number)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return undefined
  }
  return numerator / denominator
}

function parseProbeResult(raw: string): VideoProbeResult {
  const parsed = JSON.parse(raw) as {
    streams?: Array<Record<string, unknown>>
    format?: Record<string, unknown>
  }
  const streams = Array.isArray(parsed.streams) ? parsed.streams : []
  const video = streams.find((stream) => stream.codec_type === 'video')
  const audio = streams.find((stream) => stream.codec_type === 'audio')
  const durationSeconds =
    typeof parsed.format?.duration === 'string' ? Number(parsed.format.duration) : undefined

  return {
    width: typeof video?.width === 'number' ? video.width : undefined,
    height: typeof video?.height === 'number' ? video.height : undefined,
    durationMs:
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
        ? Math.round(durationSeconds * 1000)
        : undefined,
    container:
      typeof parsed.format?.format_name === 'string' ? parsed.format.format_name : undefined,
    videoCodec: typeof video?.codec_name === 'string' ? video.codec_name : undefined,
    audioCodec: typeof audio?.codec_name === 'string' ? audio.codec_name : undefined,
    frameRate: parseFrameRate(video?.avg_frame_rate)
  }
}

async function probeVideo(input: unknown): Promise<VideoProbeResult> {
  const request = validateProbeRequest(input)
  const config = await readReadyConfigForTranscode()
  if (!config.ffprobePath) throw new Error('FFprobe is not configured')
  const sourcePath = getNativeFilePath(request.sourceFileId)
  const output = await runExecutable(config.ffprobePath, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    sourcePath
  ])
  return parseProbeResult(output)
}

function validateLiveTranscodeRequest(input: unknown): VideoLiveTranscodeStartRequest {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid live transcode request')
  const request = input as Partial<VideoLiveTranscodeStartRequest>
  if (!isValidNativeFileId(request.sourceFileId))
    throw new Error('Invalid live transcode source id')
  return {
    sourceFileId: request.sourceFileId,
    profile: normalizeVideoTranscodeProfile(request.profile),
    sourceMetadata: normalizeSourceMetadata(request.sourceMetadata)
  }
}

async function startLiveTranscode(input: unknown): Promise<VideoLiveTranscodeStartResult> {
  const request = validateLiveTranscodeRequest(input)
  const config = await readReadyConfigForTranscode()
  const sourcePath = getNativeFilePath(request.sourceFileId)
  const sessionId = randomUUID()
  const args = buildTranscodeArgs({
    sourcePath,
    output: 'pipe:1',
    profile: request.profile,
    sourceMetadata: request.sourceMetadata,
    encoder: getPreferredH264Encoder(config),
    mode: 'live'
  })

  const child = spawn(config.executablePath, args, {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  if (!child?.stdout || !child.stderr) {
    throw new Error('FFmpeg process did not expose stdout or stderr')
  }

  activeLiveTranscodes.set(sessionId, { child, stderr: '' })
  child.stderr?.on('data', (chunk: Buffer) => {
    const active = activeLiveTranscodes.get(sessionId)
    if (!active || active.stderr.length >= MAX_PROCESS_OUTPUT_LENGTH) return
    active.stderr += chunk.toString('utf8')
  })
  child.on('error', (error) => {
    activeLiveTranscodes.delete(sessionId)
    console.error('[video-transcode] Live FFmpeg failed to start', {
      sessionId,
      error: error.message
    })
  })
  child.on('close', (code) => {
    const active = activeLiveTranscodes.get(sessionId)
    activeLiveTranscodes.delete(sessionId)
    if (active && code !== 0 && code !== null) {
      console.error('[video-transcode] Live FFmpeg stopped with error', {
        sessionId,
        code,
        error: active?.stderr.trim().split('\n').at(-1)
      })
    }
  })

  return {
    sessionId,
    url: `hhc-live-media://stream/${encodeURIComponent(sessionId)}`,
    mimeType: 'video/mp4'
  }
}

async function stopLiveTranscode(sessionId: unknown): Promise<void> {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('Invalid live transcode session id')
  }
  const active = activeLiveTranscodes.get(sessionId)
  if (!active) return
  activeLiveTranscodes.delete(sessionId)
  active.child.kill()
}

function stopAllLiveTranscodes(): void {
  for (const sessionId of activeLiveTranscodes.keys()) {
    const active = activeLiveTranscodes.get(sessionId)
    activeLiveTranscodes.delete(sessionId)
    active?.child.kill()
  }
}

export function registerLiveMediaProtocol(): void {
  protocol.handle('hhc-live-media', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'stream') return new Response('Not found', { status: 404 })
    const sessionId = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const active = activeLiveTranscodes.get(sessionId)
    if (!active || !active.child.stdout) return new Response('Not found', { status: 404 })
    request.signal.addEventListener('abort', () => {
      void stopLiveTranscode(sessionId).catch(() => undefined)
    })

    return new Response(Readable.toWeb(active.child.stdout) as ReadableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'none'
      }
    })
  })
}

async function generatePoster(input: unknown): Promise<VideoPosterResult> {
  const request = validatePosterRequest(input)
  const config = await readReadyConfigForTranscode()
  const sourcePath = getNativeFilePath(request.sourceFileId)
  const temporaryPath = join(
    dirname(sourcePath),
    `.${request.sourceFileId}.${randomUUID()}.poster.jpg`
  )
  const args = [
    '-hide_banner',
    '-y',
    '-ss',
    '00:00:01',
    '-i',
    sourcePath,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:-2',
    temporaryPath
  ]

  try {
    await runExecutable(config.executablePath, args)
    const data = await fs.readFile(temporaryPath)
    return { dataUrl: `data:image/jpeg;base64,${data.toString('base64')}` }
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

async function cancelTranscode(jobId: unknown): Promise<void> {
  if (typeof jobId !== 'string' || jobId.length === 0) throw new Error('Invalid transcode job id')
  const active = activeTranscodes.get(jobId)
  if (!active) return
  active.child.kill?.()
  await fs.rm(active.temporaryPath, { force: true }).catch(() => undefined)
}

export function registerVideoTranscodeHandlers(wm: WindowManager): void {
  ipcMain.handle('video-transcode:get-ffmpeg-config', async (event): Promise<FfmpegConfigInfo> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg configuration access')
    const stored = await readStoredConfig()
    if (stored) return toInfo(stored)
    const detected = await detectSystemFfmpeg()
    return detected ? { ...toInfo(detected), source: 'system' } : { status: 'not-configured' }
  })

  ipcMain.handle(
    'video-transcode:select-ffmpeg',
    async (event): Promise<FfmpegConfigInfo | null> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg configuration access')
      const result = await dialog.showOpenDialog({
        title: 'Select FFmpeg executable',
        properties: ['openFile'],
        filters:
          process.platform === 'win32'
            ? [{ name: 'Executable', extensions: ['exe', 'cmd', 'bat'] }]
            : undefined
      })
      if (result.canceled || result.filePaths.length === 0) return null

      const validation = await validateExecutablePath(result.filePaths[0])
      if (validation.stored) await writeStoredConfig(validation.stored)
      return validation.info
    }
  )

  ipcMain.handle(
    'video-transcode:select-ffprobe',
    async (event): Promise<FfmpegConfigInfo | null> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg configuration access')
      const result = await dialog.showOpenDialog({
        title: 'Select FFprobe executable',
        properties: ['openFile'],
        filters:
          process.platform === 'win32'
            ? [{ name: 'Executable', extensions: ['exe', 'cmd', 'bat'] }]
            : undefined
      })
      if (result.canceled || result.filePaths.length === 0) return null

      const validation = await validateFfprobeExecutablePath(result.filePaths[0])
      if (validation.stored) await writeStoredConfig(validation.stored)
      return validation.info
    }
  )

  ipcMain.handle('video-transcode:validate-ffmpeg', async (event): Promise<FfmpegConfigInfo> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg configuration access')
    const stored = await readStoredConfig()
    if (!stored) return { status: 'not-configured' }
    const validation = await validateExecutablePath(stored.executablePath)
    if (validation.stored) await writeStoredConfig(validation.stored)
    return validation.info
  })

  ipcMain.handle(
    'video-transcode:remove-ffmpeg-config',
    async (event): Promise<FfmpegConfigInfo> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg configuration access')
      await removeStoredConfig()
      return { status: 'not-configured' }
    }
  )

  ipcMain.handle(
    'video-transcode:run',
    async (event, request: unknown): Promise<VideoTranscodeRunResult> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg transcode access')
      return runTranscode(request)
    }
  )

  ipcMain.handle('video-transcode:cancel', async (event, jobId: unknown): Promise<void> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg transcode access')
    await cancelTranscode(jobId)
  })

  ipcMain.handle(
    'video-transcode:generate-poster',
    async (event, request: unknown): Promise<VideoPosterResult> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg poster access')
      return generatePoster(request)
    }
  )

  ipcMain.handle(
    'video-transcode:probe',
    async (event, request: unknown): Promise<VideoProbeResult> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg probe access')
      return probeVideo(request)
    }
  )

  ipcMain.handle(
    'video-transcode:start-live',
    async (event, request: unknown): Promise<VideoLiveTranscodeStartResult> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg live transcode access')
      return startLiveTranscode(request)
    }
  )

  ipcMain.handle('video-transcode:stop-live', async (event, sessionId: unknown): Promise<void> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg live transcode access')
    await stopLiveTranscode(sessionId)
  })

  app.once('before-quit', stopAllLiveTranscodes)
}
