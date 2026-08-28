import { describe, expect, it } from 'vitest'
import { calculateAnchoredScroll, calculateFitZoomPercent } from '../presentation-viewport'

describe('presentation viewport geometry', () => {
  it('fits the canvas inside the padded viewport', () => {
    expect(calculateFitZoomPercent(1050, 486, 1024, 576, 64)).toBe(73)
    expect(calculateFitZoomPercent(500, 300, 1024, 576, 64)).toBe(40)
  })

  it('keeps the logical slide coordinate under the pointer', () => {
    expect(calculateAnchoredScroll(200, 300, 100, 150)).toBe(450)
  })
})
