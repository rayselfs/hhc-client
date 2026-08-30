import { afterEach, describe, expect, it, vi } from 'vitest'

const { workerMessageHandler } = vi.hoisted(() => ({
  workerMessageHandler: { setup: vi.fn() }
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  VerbosityLevel: { ERRORS: 0 }
}))

vi.mock('pdfjs-dist/build/pdf.worker.mjs', () => ({
  WorkerMessageHandler: workerMessageHandler
}))

vi.mock('../pdf-worker-polyfill.worker.ts?worker&url', () => ({
  default: '/assets/pdf-worker-test.js'
}))

import { loadPdfjsLib, loadPdfjsWorkerLib } from '../pdfjs-loader'

describe('loadPdfjsLib', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker
  })

  it('configures renderer PDF.js without installing a main-thread worker handler', async () => {
    vi.stubGlobal('document', {})

    const pdfjs = await loadPdfjsLib()

    expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain('pdf-worker')
    expect((globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker).toBeUndefined()
  })

  it('installs the official local handler only for an existing background worker', async () => {
    vi.stubGlobal('document', undefined)

    await loadPdfjsWorkerLib()

    expect((globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker).toEqual({
      WorkerMessageHandler: workerMessageHandler
    })
  })
})
