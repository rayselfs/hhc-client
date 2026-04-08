import parseDurationMs from 'parse-duration-ms'

/**
 * Parse flexible time input into seconds.
 * Supports: '90s', '1m30s', '1m 30s', '03:00', '1:30:00', '180' (bare number = seconds)
 * Returns null for invalid/empty input or negative values.
 */
export function parseDuration(input: string): number | null {
  // 1. Normalize
  const normalized = input.trim().toLowerCase()
  if (!normalized) return null

  // 2. Try parse-duration-ms (handles '90s', '1m30s', '1h 30m', etc.)
  //    parse-duration-ms returns milliseconds
  const ms = parseDurationMs(normalized)
  if (ms !== undefined && ms >= 0) {
    return Math.round(ms / 1000)
  }

  // 3. Try HH:MM:SS (e.g., '1:30:00')
  const hhmmss = normalized.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (hhmmss) {
    const [, h, m, s] = hhmmss.map(Number)
    return h * 3600 + m * 60 + s
  }

  // 4. Try MM:SS (e.g., '03:00', '1:30')
  const mmss = normalized.match(/^(\d+):(\d{2})$/)
  if (mmss) {
    const [, m, s] = mmss.map(Number)
    return m * 60 + s
  }

  // 5. Try bare number (interpreted as seconds)
  const bare = Number(normalized)
  if (!isNaN(bare) && bare >= 0) return Math.floor(bare)

  return null
}

/**
 * Format seconds into display string.
 * < 1 hour: 'MM:SS'
 * >= 1 hour: 'H:MM:SS'
 */
export function formatDuration(seconds: number): string {
  const abs = Math.abs(Math.floor(seconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${mm}:${ss}`
  return `${mm}:${ss}`
}
