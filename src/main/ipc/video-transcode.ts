import { app, dialog, ipcMain } from 'electron'
import { spawn } from 'child_process'
import { constants as fsConstants, promises as fs } from 'fs'
import { basename, dirname, extname, isAbsolute, join } from 'path'
import type {
  FfmpegCapabilityInfo,
  FfmpegConfigInfo,
  FfmpegConfigStatus
} from '../../shared/ipc-channels'
import type { WindowManager } from '../windowManager'
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

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME)
}

function toInfo(config: StoredFfmpegConfig): FfmpegConfigInfo {
  return {
    status: 'ready',
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

  try {
    const versionOutput = await runExecutable(resolvedPath, ['-version'])
    const version = parseVersion(versionOutput)
    if (!version)
      return { info: createInfo('unsupported-version', 'Unable to detect FFmpeg version') }

    const [encoders, muxers] = await Promise.all([
      runExecutable(resolvedPath, ['-hide_banner', '-encoders']),
      runExecutable(resolvedPath, ['-hide_banner', '-muxers'])
    ])
    const capabilities = parseCapabilities(encoders, muxers)
    if (!capabilities.hasH264Encoder || !capabilities.hasAacEncoder || !capabilities.hasMp4Muxer) {
      return {
        info: {
          status: 'invalid',
          executableName: basename(resolvedPath),
          version,
          capabilities,
          message: 'FFmpeg is missing required H.264, AAC, or MP4 capabilities',
          validatedAt: Date.now()
        }
      }
    }

    const stored: StoredFfmpegConfig = {
      executablePath: resolvedPath,
      executableName: basename(resolvedPath),
      version,
      capabilities,
      validatedAt: Date.now()
    }
    return { info: toInfo(stored), stored }
  } catch (error) {
    return {
      info: createInfo(
        'invalid',
        error instanceof Error ? error.message : 'FFmpeg validation failed'
      )
    }
  }
}

export function registerVideoTranscodeHandlers(wm: WindowManager): void {
  ipcMain.handle('video-transcode:get-ffmpeg-config', async (event): Promise<FfmpegConfigInfo> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized FFmpeg configuration access')
    const stored = await readStoredConfig()
    return stored ? toInfo(stored) : { status: 'not-configured' }
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
}
