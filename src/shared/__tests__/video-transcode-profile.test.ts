import { describe, expect, it } from 'vitest'
import { getTargetVideoHeight, getVideoRateControl } from '../video-transcode-profile'

describe('video transcode profile', () => {
  it('does not upscale sources below the selected resolution', () => {
    expect(getTargetVideoHeight(400, '4k')).toBe(400)
    expect(getTargetVideoHeight(720, '1080p')).toBe(720)
  })

  it('caps sources above the selected resolution', () => {
    expect(getTargetVideoHeight(2160, '1080p')).toBe(1080)
    expect(getTargetVideoHeight(1080, '720p')).toBe(720)
  })

  it('uses bitrate tiers from the effective output height and quality', () => {
    expect(
      getVideoRateControl({ sourceHeight: 400, profile: { resolution: '4k', quality: 'high' } })
    ).toMatchObject({ targetHeight: 400, bitrateKbps: 1800, maxrateKbps: 2700, bufsizeKbps: 3600 })
    expect(
      getVideoRateControl({
        sourceHeight: 2160,
        profile: { resolution: '1080p', quality: 'high' }
      })
    ).toMatchObject({
      targetHeight: 1080,
      bitrateKbps: 7000,
      maxrateKbps: 10500,
      bufsizeKbps: 14000
    })
  })
})
