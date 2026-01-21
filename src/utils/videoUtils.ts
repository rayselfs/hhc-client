/**
 * Video Utilities
 *
 * Shared utilities for video processing across MediaPresenter and MediaProjection.
 * Centralizes transcode detection and URL building to eliminate code duplication.
 *
 * Note: Timeline seeking is DISABLED for transcoded videos (MKV, AVI, etc.).
 * Users can only play these videos from the beginning.
 * Native formats (MP4, WebM) support full timeline seeking.
 */

/**
 * Extensions that require FFmpeg transcoding (cannot use native Range seek)
 * These formats are not natively supported by HTML5 video element
 */
export const TRANSCODE_EXTENSIONS: readonly string[] = [
  '.mkv',
  '.avi',
  '.wmv',
  '.flv',
  '.ts',
  '.m2ts',
  '.mov',
] as const

/**
 * Check if a URL needs transcoding based on file extension
 *
 * @param url - Video URL to check
 * @returns true if the video needs FFmpeg transcoding
 *
 * @example
 * needsTranscode('local-resource://path/to/video.mkv') // true
 * needsTranscode('local-resource://path/to/video.mp4') // false
 */
export function needsTranscode(url: string): boolean {
  if (!url) return false
  // Extract extension, handling query parameters
  const urlWithoutQuery = url.split('?')[0] ?? ''
  const ext = urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')).toLowerCase()
  return TRANSCODE_EXTENSIONS.includes(ext)
}

/**
 * Options for building video URL
 */
export interface BuildVideoUrlOptions {
  /** Base video URL (e.g., local-resource://path/to/video.mkv) */
  baseUrl: string
  /** Whether this URL is for transcoded video (auto-detected if not provided) */
  isTranscoded?: boolean
  /** Window identifier for debugging (e.g., 'preview', 'projection') */
  window?: string
}

/**
 * Build video URL with cache-busting timestamp
 *
 * For transcoded videos (MKV, AVI, etc.), the video always starts from the beginning.
 * Timeline seeking is disabled for these formats.
 *
 * @param options - URL building options
 * @returns Complete video URL with query parameters
 *
 * @example
 * buildVideoUrl({ baseUrl: 'video.mp4' })
 * // => 'video.mp4?t=1234567890'
 *
 * buildVideoUrl({ baseUrl: 'video.mkv', window: 'preview' })
 * // => 'video.mkv?window=preview&t=1234567890'
 */
export function buildVideoUrl(options: BuildVideoUrlOptions): string {
  const { baseUrl, window } = options

  // Timestamp to force reload (cache busting)
  const timestamp = Date.now()

  // Build query parameters
  const params = new URLSearchParams()

  // Add window identifier for debugging
  if (window) {
    params.set('window', window)
  }

  // Add timestamp for cache busting
  params.set('t', timestamp.toString())

  return `${baseUrl}?${params.toString()}`
}

/**
 * Throttle interval for time reporting from projection to main window (in milliseconds)
 */
export const TIME_REPORT_THROTTLE_MS = 500

/**
 * Maximum drift before hard seek correction (in seconds)
 */
export const MAX_DRIFT_THRESHOLD_S = 1.0

/**
 * Drift threshold for playback rate adjustment (in seconds)
 */
export const DRIFT_RATE_THRESHOLD_S = 0.1
