import { app, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { spawn, type ChildProcess } from 'child_process'
import { constants as fsConstants, promises as fs } from 'fs'
import { basename, dirname, extname, isAbsolute, join } from 'path'
import { isValidNativeFileId } from '../../shared/native-media'
import type {
  FfmpegCapabilityInfo,
  FfmpegConfigInfo,
  FfmpegConfigStatus,
  VideoPosterRequest,
  VideoPosterResult,
  VideoTranscodeRunRequest,
  VideoTranscodeRunResult
} from '../../shared/ipc-channels'
import type { WindowManager } from '../windowManager'
import { getNativeFilePath } from './native-fs'
import { isMainWindow } from './validate'

interface StoredFfmpegConfig {
  executablePath: string
  executableName: string
  version: string
  capabilities: FfmpegCapabilityInfo
  validatedAt: number
}

const CONFIG_FILE_NAME = 'ffmpeg-config.json'
const VALIDATION_TIMEOUT_MS = 5000
const MAX_PROCESS_OUTPUT_LENGTH = 1024 * 1024
const WINDOWS_EXECUTABLE_EXTENSIONS = new Set(['.exe', '.cmd', '.bat'])
const activeTranscodes = new Map<string, { child: ChildProcess; temporaryPath: string }>()

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME)
}

function toInfo(config: StoredFfmpegConfig): FfmpegConfigInfo {
  return {
    status: 'ready',
    source: 'stored',
    executableName: config.executableName,
    version: config.version,
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
    activeTranscodes.set(jobId, { child, temporaryPath })
    let stderr = ''

    const appendError = (chunk: Buffer): void => {
      if (stderr.length < MAX_PROCESS_OUTPUT_LENGTH) stderr += chunk.toString('utf8')
    }

    child.stdout.on('data', () => undefined)
    child.stderr.on('data', appendError)
    child.on('error', (error) => {
      activeTranscodes.delete(jobId)
      reject(error)
    })
    child.on('close', (code) => {
      activeTranscodes.delete(jobId)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr.trim() || `FFmpeg exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

function parseVersion(output: string): string | null {
  const match = output.match(/ffmpeg version\s+([^\s]+)/i)
  return match?.[1] ?? null
}

function parseCapabilities(encoders: string, muxers: string): FfmpegCapabilityInfo {
  return {
    hasH264Encoder: /^\s*V\S*\s+libx264\b/m.test(encoders),
    hasAacEncoder: /^\s*A\S*\s+aac\b/m.test(encoders),
    hasMp4Muxer: /^\s*E\s+mp4\b/m.test(muxers)
  }
}

async function validateRunnable(
  executablePath: string,
  executableName: string,
  source: 'stored' | 'system' = 'stored'
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

    const stored: StoredFfmpegConfig = {
      executablePath,
      executableName,
      version,
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

async function validateExecutablePath(executablePath: unknown): Promise<{
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

  return validateRunnable(resolvedPath, basename(resolvedPath), 'stored')
}

async function detectSystemFfmpeg(): Promise<StoredFfmpegConfig | null> {
  const validation = await validateRunnable('ffmpeg', 'ffmpeg', 'system')
  return validation.info.status === 'ready' && validation.stored ? validation.stored : null
}

async function readReadyConfig(): Promise<StoredFfmpegConfig | null> {
  const stored = await readStoredConfig()
  if (stored) {
    const validation = await validateExecutablePath(stored.executablePath)
    if (validation.stored) {
      await writeStoredConfig(validation.stored)
      return validation.stored
    }
  }

  return detectSystemFfmpeg()
}

async function readReadyConfigForTranscode(): Promise<StoredFfmpegConfig> {
  const config = await readReadyConfig()
  if (!config) throw new Error('FFmpeg is not configured')
  return config
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
    outputFileId: request.outputFileId
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
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    temporaryPath
  ]

  try {
    await runTranscodeProcess(request.jobId, config.executablePath, args, temporaryPath)
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
  active.child.kill()
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
}
