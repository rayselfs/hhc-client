import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAccessSync, mockProbeDefaultVlcDir, mockApp } = vi.hoisted(() => ({
  mockAccessSync: vi.fn(),
  mockProbeDefaultVlcDir: vi.fn(),
  mockApp: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/app')
  }
}))

vi.mock('electron', () => ({
  app: mockApp
}))

vi.mock('fs', () => ({
  accessSync: mockAccessSync,
  constants: { F_OK: 0, X_OK: 1 },
  default: {
    accessSync: mockAccessSync,
    constants: { F_OK: 0, X_OK: 1 }
  }
}))

vi.mock('electron-vlc-player', () => ({
  probeDefaultVlcDir: mockProbeDefaultVlcDir
}))

function platformDir(): string {
  return `${process.platform}-${process.arch}`
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApp.isPackaged = false
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: '/resources'
  })
})

describe('video engine runtime resolver', () => {
  it('prefers packaged VLC runtime over system fallback', async () => {
    mockApp.isPackaged = true
    mockAccessSync.mockImplementation((path: string) => {
      if (path.endsWith('libvlc.dylib')) return undefined
      throw new Error('missing')
    })
    mockProbeDefaultVlcDir.mockReturnValue('/Applications/VLC.app')
    const { resolveVlcRuntime } = await import('../video-engine-runtime')

    expect(resolveVlcRuntime()).toEqual({
      status: 'ready',
      path: `/resources/video-engine/vlc/${platformDir()}`,
      source: 'bundled'
    })
  })

  it('does not treat a placeholder VLC directory as bundled runtime', async () => {
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing')
    })
    mockProbeDefaultVlcDir.mockReturnValue('/Applications/VLC.app')
    const { resolveVlcRuntime } = await import('../video-engine-runtime')

    expect(resolveVlcRuntime()).toEqual({
      status: 'ready',
      path: '/Applications/VLC.app',
      source: 'system'
    })
  })

  it('falls back to system VLC when bundled runtime is missing', async () => {
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing')
    })
    mockProbeDefaultVlcDir.mockReturnValue('/Applications/VLC.app')
    const { resolveVlcRuntime } = await import('../video-engine-runtime')

    expect(resolveVlcRuntime()).toEqual({
      status: 'ready',
      path: '/Applications/VLC.app',
      source: 'system'
    })
  })

  it('does not fall back to system VLC in packaged builds', async () => {
    mockApp.isPackaged = true
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing')
    })
    mockProbeDefaultVlcDir.mockReturnValue('/Applications/VLC.app')
    const { resolveVlcRuntime } = await import('../video-engine-runtime')

    expect(resolveVlcRuntime()).toEqual({
      status: 'missing',
      message: 'Bundled VLC runtime not found'
    })
  })

  it('prefers packaged FFmpeg poster binary', async () => {
    mockAccessSync.mockReturnValue(undefined)
    const { resolveFfmpegPosterRuntime } = await import('../video-engine-runtime')
    const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

    expect(resolveFfmpegPosterRuntime()).toEqual({
      status: 'ready',
      path: `/app/resources/video-engine/ffmpeg/${platformDir()}/${executable}`,
      source: 'bundled'
    })
  })

  it('falls back to system FFmpeg command in development', async () => {
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing')
    })
    const { resolveFfmpegPosterRuntime } = await import('../video-engine-runtime')
    const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

    expect(resolveFfmpegPosterRuntime()).toEqual({
      status: 'ready',
      path: executable,
      source: 'system'
    })
  })

  it('does not fall back to system FFmpeg in packaged builds', async () => {
    mockApp.isPackaged = true
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing')
    })
    const { resolveFfmpegPosterRuntime } = await import('../video-engine-runtime')

    expect(resolveFfmpegPosterRuntime()).toEqual({
      status: 'missing',
      message: 'Bundled FFmpeg poster runtime not found'
    })
  })
})
