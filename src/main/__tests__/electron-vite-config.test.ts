import { describe, expect, it, vi } from 'vitest'
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

it('pre-optimizes PDF.js and its worker in renderer development', async () => {
  const { TextEncoder } = await import('node:util')
  vi.stubGlobal('TextEncoder', TextEncoder)
  vi.stubGlobal('Uint8Array', new TextEncoder().encode('').constructor)
  const { default: electronViteConfig } = await import('../../../electron.vite.config')
  const createConfig = electronViteConfig as unknown as (environment: {
    command: 'serve'
    mode: string
  }) => {
    renderer?: { optimizeDeps?: { include?: string[] } }
  }
  const config = createConfig({ command: 'serve', mode: 'test' })

  expect(config.renderer?.optimizeDeps?.include).toEqual([
    'pdfjs-dist',
    'pdfjs-dist/build/pdf.worker.mjs'
  ])
  vi.unstubAllGlobals()
})
