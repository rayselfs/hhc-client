import { describe, it, expect } from 'vitest'
import { parseDuration, formatDuration } from '../parse-duration'

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
