import { describe, expect, it } from 'vitest'
import { calculateAnchoredScroll, calculateFitZoomPercent } from '../presentation-viewport'

describe('presentation viewport geometry', () => {
  it.each([
    ['floors the fitted ratio', 1050, 486, 1024, 576, 64, 73],
    ['clamps below the minimum', 100, 100, 1024, 576, 64, 25],
    ['clamps above the maximum', 4096, 2304, 1024, 576, 0, 200],
    ['handles an exhausted viewport', 64, 64, 1024, 576, 64, 25],
    ['handles a zero-size canvas', 1050, 486, 0, 0, 64, 25],
    ['handles non-finite geometry', Number.POSITIVE_INFINITY, 486, 1024, 576, 64, 25]
  ])('%s', (_name, viewportWidth, viewportHeight, canvasWidth, canvasHeight, padding, expected) => {
    expect(
      calculateFitZoomPercent(viewportWidth, viewportHeight, canvasWidth, canvasHeight, padding)
    ).toBe(expected)
  })

  it('keeps the logical slide coordinate under the pointer', () => {
    expect(calculateAnchoredScroll(200, 300, 100, 150)).toBe(450)
  })
})
