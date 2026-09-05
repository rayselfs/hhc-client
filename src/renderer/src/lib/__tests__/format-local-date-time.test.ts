import { describe, expect, it } from 'vitest'
import { formatLocalDateTime } from '../format-local-date-time'

describe('formatLocalDateTime', () => {
  it('formats local time with seconds using zero-padded 24-hour fields', () => {
    const timestamp = new Date(2026, 8, 4, 22, 3, 5).getTime()

    expect(formatLocalDateTime(timestamp)).toBe('2026/09/04 22:03:05')
  })

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns an em dash for an invalid timestamp',
    (timestamp) => {
      expect(formatLocalDateTime(timestamp)).toBe('—')
    }
  )
})
