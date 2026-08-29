import { afterEach, describe, expect, it, vi } from 'vitest'

const { workerMessageHandler } = vi.hoisted(() => ({
  workerMessageHandler: { setup: vi.fn() }
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' }
}))

vi.mock('pdfjs-dist/build/pdf.worker.mjs', () => ({
  WorkerMessageHandler: workerMessageHandler
}))

import { loadPdfjsLib } from '../pdfjs-loader'

describe('loadPdfjsLib', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker
  })

  it('registers the official fake-worker handler inside a Worker context', async () => {
    vi.stubGlobal('document', undefined)

    await loadPdfjsLib()

    expect((globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker).toEqual({
      WorkerMessageHandler: workerMessageHandler
    })
  })
})
