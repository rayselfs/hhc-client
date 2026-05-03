import { describe, it, expect } from 'vitest'
import { parseDuration, formatDuration, formatDurationHMS } from '../parse-duration'

describe('parseDuration', () => {
  it('parses seconds with s suffix', () => {
    expect(parseDuration('90s')).toBe(90)
  })

  it('parses minutes and seconds', () => {
    expect(parseDuration('1m30s')).toBe(90)
  })

  it('parses minutes and seconds with space', () => {
    expect(parseDuration('1m 30s')).toBe(90)
  })

  it('parses MM:SS format', () => {
    expect(parseDuration('03:00')).toBe(180)
  })

  it('parses HH:MM:SS format', () => {
    expect(parseDuration('1:30:00')).toBe(5400)
  })

  it('parses bare number as seconds', () => {
    expect(parseDuration('180')).toBe(180)
  })

  it('parses zero', () => {
    expect(parseDuration('0')).toBe(0)
  })

  it('returns null for empty string', () => {
    expect(parseDuration('')).toBeNull()
  })

  it('returns null for whitespace only', () => {
    expect(parseDuration('   ')).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(parseDuration('abc')).toBeNull()
  })

  it('returns null for negative values', () => {
    expect(parseDuration('-5')).toBeNull()
  })

  it('parses hours with h suffix', () => {
    expect(parseDuration('1h')).toBe(3600)
  })

  it('parses hours and minutes with h and m suffixes', () => {
    expect(parseDuration('2h30m')).toBe(9000)
  })
})

describe('formatDuration', () => {
  it('formats 90 seconds as MM:SS', () => {
    expect(formatDuration(90)).toBe('01:30')
  })

  it('formats 3661 seconds with hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('formats zero as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('formats 3600 seconds (1 hour) as H:MM:SS', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('formats 59 seconds', () => {
    expect(formatDuration(59)).toBe('00:59')
  })

  it('formats 600 seconds (10 minutes)', () => {
    expect(formatDuration(600)).toBe('10:00')
  })
})

describe('formatDurationHMS', () => {
  it('formats 0 as 00:00:00', () => {
    expect(formatDurationHMS(0)).toBe('00:00:00')
  })

  it('formats 90 seconds as 00:01:30', () => {
    expect(formatDurationHMS(90)).toBe('00:01:30')
  })

  it('formats 3600 seconds as 01:00:00', () => {
    expect(formatDurationHMS(3600)).toBe('01:00:00')
  })

  it('formats 3661 seconds as 01:01:01', () => {
    expect(formatDurationHMS(3661)).toBe('01:01:01')
  })

  it('formats 36000 seconds (10 hours) as 10:00:00', () => {
    expect(formatDurationHMS(36000)).toBe('10:00:00')
  })

  it('handles negative values using absolute value', () => {
    expect(formatDurationHMS(-90)).toBe('00:01:30')
  })
})
