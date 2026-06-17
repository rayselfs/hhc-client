export type VideoTranscodeResolution = '4k' | '1080p' | '720p'
export type VideoTranscodeQuality = 'high' | 'medium' | 'low'
export type H264EncoderName =
  | 'h264_videotoolbox'
  | 'h264_nvenc'
  | 'h264_qsv'
  | 'h264_amf'
  | 'libx264'

export interface VideoTranscodeProfile {
  resolution: VideoTranscodeResolution
  quality: VideoTranscodeQuality
}

export interface VideoTranscodeSourceMetadata {
  width?: number
  height?: number
  durationMs?: number
  container?: string
  videoCodec?: string
  audioCodec?: string
  frameRate?: number
}

export const DEFAULT_VIDEO_TRANSCODE_PROFILE: VideoTranscodeProfile = {
  resolution: '1080p',
  quality: 'high'
}

export const VIDEO_TRANSCODE_RESOLUTIONS: VideoTranscodeResolution[] = ['4k', '1080p', '720p']
export const VIDEO_TRANSCODE_QUALITIES: VideoTranscodeQuality[] = ['high', 'medium', 'low']

const RESOLUTION_MAX_HEIGHT: Record<VideoTranscodeResolution, number> = {
  '4k': 2160,
  '1080p': 1080,
  '720p': 720
}

const BITRATE_TABLE: Record<
  '360p' | '480p' | '720p' | '1080p' | '4k',
  Record<VideoTranscodeQuality, number>
> = {
  '360p': { low: 500, medium: 800, high: 1200 },
  '480p': { low: 700, medium: 1200, high: 1800 },
  '720p': { low: 1200, medium: 2200, high: 3500 },
  '1080p': { low: 2500, medium: 4500, high: 7000 },
  '4k': { low: 8000, medium: 12000, high: 18000 }
}

export function normalizeVideoTranscodeProfile(value: unknown): VideoTranscodeProfile {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const resolution = VIDEO_TRANSCODE_RESOLUTIONS.includes(
    record.resolution as VideoTranscodeResolution
  )
    ? (record.resolution as VideoTranscodeResolution)
    : DEFAULT_VIDEO_TRANSCODE_PROFILE.resolution
  const quality = VIDEO_TRANSCODE_QUALITIES.includes(record.quality as VideoTranscodeQuality)
    ? (record.quality as VideoTranscodeQuality)
    : DEFAULT_VIDEO_TRANSCODE_PROFILE.quality

  return { resolution, quality }
}

export function getTargetVideoHeight(
  sourceHeight: number | undefined,
  resolution: VideoTranscodeResolution
): number {
  const maxHeight = RESOLUTION_MAX_HEIGHT[resolution]
  if (!sourceHeight || !Number.isFinite(sourceHeight) || sourceHeight <= 0) return maxHeight
  return Math.min(Math.floor(sourceHeight), maxHeight)
}

export function getVideoBitrateKbps(
  targetHeight: number,
  quality: VideoTranscodeQuality
): number {
  if (targetHeight <= 360) return BITRATE_TABLE['360p'][quality]
  if (targetHeight <= 480) return BITRATE_TABLE['480p'][quality]
  if (targetHeight <= 720) return BITRATE_TABLE['720p'][quality]
  if (targetHeight <= 1080) return BITRATE_TABLE['1080p'][quality]
  return BITRATE_TABLE['4k'][quality]
}

export function getVideoRateControl(input: {
  sourceHeight?: number
  profile: VideoTranscodeProfile
}): {
  targetHeight: number
  bitrateKbps: number
  maxrateKbps: number
  bufsizeKbps: number
} {
  const targetHeight = getTargetVideoHeight(input.sourceHeight, input.profile.resolution)
  const bitrateKbps = getVideoBitrateKbps(targetHeight, input.profile.quality)
  return {
    targetHeight,
    bitrateKbps,
    maxrateKbps: Math.round(bitrateKbps * 1.5),
    bufsizeKbps: bitrateKbps * 2
  }
}
