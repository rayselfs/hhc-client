import { describe, it, expect, vi } from 'vitest'
import type { FFmpegStatus } from '@/types/electron'

describe('MediaSettings', () => {
  const mockFfmpegStatus: FFmpegStatus = {
    available: true,
    path: '/usr/local/bin/ffmpeg',
    version: '6.0',
    error: '',
  }

  it('should have correct props interface', () => {
    const props = {
      ffmpegStatus: mockFfmpegStatus,
      customFfmpegPath: '',
      enableFfmpeg: true,
      videoQuality: 'high' as 'low' | 'medium' | 'high',
      videoQualityOptions: [
        {
          text: 'settings.videoQualityOptions.high',
          value: 'high',
          description: 'settings.videoQualityOptions.highDesc',
        },
      ],
    }

    expect(props.ffmpegStatus.available).toBe(true)
    expect(props.enableFfmpeg).toBe(true)
    expect(props.videoQuality).toBe('high')
  })

  it('should handle custom path change', () => {
    const mockEmit = vi.fn()

    mockEmit('customPathChange')

    expect(mockEmit).toHaveBeenCalledWithExactlyOnceWith('customPathChange')
  })

  it('should handle enable ffmpeg change', () => {
    const mockEmit = vi.fn()
    const newValue = false

    mockEmit('enableFfmpegChange', newValue)

    expect(mockEmit).toHaveBeenCalledWithExactlyOnceWith('enableFfmpegChange', false)
  })

  it('should handle video quality change', () => {
    const mockEmit = vi.fn()
    const newQuality = 'medium'

    mockEmit('videoQualityChange', newQuality)

    expect(mockEmit).toHaveBeenCalledWithExactlyOnceWith('videoQualityChange', 'medium')
  })

  it('should handle show install guide', () => {
    const mockEmit = vi.fn()

    mockEmit('showInstallGuide')

    expect(mockEmit).toHaveBeenCalledWithExactlyOnceWith('showInstallGuide')
  })
})
