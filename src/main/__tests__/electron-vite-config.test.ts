import { describe, expect, it } from 'vitest'
import { rendererManualChunk } from '../../../scripts/renderer-manual-chunk'

describe('renderer manual chunks', () => {
  it('keeps React core separate without misclassifying React Aria packages', () => {
    expect(rendererManualChunk('C:/app/node_modules/react/index.js')).toBe('react-vendor')
    expect(rendererManualChunk('C:/app/node_modules/react-dom/client.js')).toBe('react-vendor')
    expect(rendererManualChunk('C:/app/node_modules/react-aria-components/dist/index.js')).toBe(
      'ui-vendor'
    )
    expect(rendererManualChunk('C:/app/node_modules/@react-aria/color/dist/index.js')).toBe(
      'ui-vendor'
    )
    expect(rendererManualChunk('C:/app/node_modules/@react-stately/color/dist/index.js')).toBe(
      'ui-vendor'
    )
  })
})
