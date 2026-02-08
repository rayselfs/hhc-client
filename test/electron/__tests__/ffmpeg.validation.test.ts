/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { existsSync, accessSync, constants } from 'fs'
import { execSync } from 'child_process'

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    accessSync: vi.fn(),
    constants: { X_OK: 1 },
  }
})

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test/userData'),
    isPackaged: false,
  },
}))

vi.mock('../../../electron/appSettings', () => ({
  appSettings: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('FFmpeg Path Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject non-existent paths', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(false)

    const result = setCustomFFmpegPath('/nonexistent/ffmpeg')

    expect(result.available).toBe(false)
    expect(result.error).toContain('Invalid FFmpeg path')
  })

  it('should reject non-executable files', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    const result = setCustomFFmpegPath('/path/to/non-executable')

    expect(result.available).toBe(false)
    expect(result.error).toContain('Invalid FFmpeg path')
  })

  it('should accept valid executable FFmpeg paths', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation(() => {})
    vi.mocked(execSync).mockReturnValue('ffmpeg version 5.1.2')

    const result = setCustomFFmpegPath('/usr/local/bin/ffmpeg')

    expect(result.available).toBe(true)
    expect(result.path).toBe('/usr/local/bin/ffmpeg')
  })

  it('should reject files that fail version check', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation(() => {})
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('Command failed')
    })

    const result = setCustomFFmpegPath('/path/to/fake-ffmpeg')

    expect(result.available).toBe(false)
    expect(result.error).toContain('Invalid FFmpeg path')
  })

  it('should validate executable permission on Unix systems', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation((path, mode) => {
      if (mode === constants.X_OK) {
        throw new Error('EACCES: permission denied')
      }
    })

    const result = setCustomFFmpegPath('/path/to/no-exec-permission')

    expect(result.available).toBe(false)
    expect(vi.mocked(accessSync)).toHaveBeenCalledWith(
      '/path/to/no-exec-permission',
      constants.X_OK,
    )
  })

  it('should reject non-executable files', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    const result = setCustomFFmpegPath('/path/to/non-executable')

    expect(result.available).toBe(false)
    expect(result.error).toContain('Invalid FFmpeg path')
  })

  it('should accept valid executable FFmpeg paths', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation(() => {})
    vi.mocked(execSync).mockReturnValue('ffmpeg version 5.1.2')

    const result = setCustomFFmpegPath('/usr/local/bin/ffmpeg')

    expect(result.available).toBe(true)
    expect(result.path).toBe('/usr/local/bin/ffmpeg')
  })

  it('should reject files that fail version check', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation(() => {})
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('Command failed')
    })

    const result = setCustomFFmpegPath('/path/to/fake-ffmpeg')

    expect(result.available).toBe(false)
    expect(result.error).toContain('Invalid FFmpeg path')
  })

  it('should validate executable permission on Unix systems', async () => {
    const { setCustomFFmpegPath } = await import('../../../electron/ffmpeg')

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(accessSync).mockImplementation((path, mode) => {
      if (mode === constants.X_OK) {
        throw new Error('EACCES: permission denied')
      }
    })

    const result = setCustomFFmpegPath('/path/to/no-exec-permission')

    expect(result.available).toBe(false)
    expect(vi.mocked(accessSync)).toHaveBeenCalledWith(
      '/path/to/no-exec-permission',
      constants.X_OK,
    )
  })
})
