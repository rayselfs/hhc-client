import { app } from 'electron'
import { accessSync, constants } from 'fs'
import { join } from 'path'

export type VideoEngineRuntimeStatus = 'ready' | 'missing' | 'error'

export interface VideoEngineRuntimeInfo {
  status: VideoEngineRuntimeStatus
  path?: string
  source?: 'bundled' | 'system'
  message?: string
}

function platformDir(): string {
  return `${process.platform}-${process.arch}`
}

function resourcesRoot(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
}

function canExecute(path: string): boolean {
  try {
    accessSync(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

function canUseBundledVlc(path: string): boolean {
  if (process.platform === 'darwin') {
    return [
      'libvlc.dylib',
      'libvlc.5.dylib',
      join('lib', 'libvlc.dylib'),
      join('lib', 'libvlc.5.dylib')
    ].some((file) => canExecute(join(path, file)))
  }
  if (process.platform === 'win32') {
    return canExecute(join(path, 'libvlc.dll'))
  }
  return canExecute(join(path, 'libvlc.so')) || canExecute(join(path, 'libvlc.so.5'))
}

function bundledPath(...parts: string[]): string {
  return join(resourcesRoot(), 'video-engine', ...parts)
}

export function resolveVlcRuntime(
  probeDefaultVlcDir?: () => string | null
): VideoEngineRuntimeInfo {
  const bundled = bundledPath('vlc', platformDir())
  if (canUseBundledVlc(bundled)) return { status: 'ready', path: bundled, source: 'bundled' }
  if (app.isPackaged) return { status: 'missing', message: 'Bundled VLC runtime not found' }

  const system = probeDefaultVlcDir?.() ?? null
  if (system) return { status: 'ready', path: system, source: 'system' }

  return { status: 'missing', message: 'VLC runtime not found' }
}

export function resolveFfmpegPosterRuntime(): VideoEngineRuntimeInfo {
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const bundled = bundledPath('ffmpeg', platformDir(), executable)
  if (canExecute(bundled)) return { status: 'ready', path: bundled, source: 'bundled' }
  if (app.isPackaged) {
    return { status: 'missing', message: 'Bundled FFmpeg poster runtime not found' }
  }

  return {
    status: 'ready',
    path: executable,
    source: 'system'
  }
}
