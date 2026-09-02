import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDocument, destroy } = vi.hoisted(() => ({
  getDocument: vi.fn(),
  destroy: vi.fn(async () => undefined)
}))

vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsWorkerLib: vi.fn(async () => ({
    getDocument,
    VerbosityLevel: { ERRORS: 0 }
  }))
}))

describe('thumbnail render worker', () => {
  beforeEach(() => {
    vi.resetModules()
    getDocument.mockReset()
    destroy.mockClear()
  })

  it('renders PDFs without relying on DOM canvas or font APIs', async () => {
    let onMessage: ((event: MessageEvent) => void) | undefined
    let filterResult: string | undefined
    const postMessage = vi.fn()
    class MockOffscreenCanvas {
      width: number
      height: number

      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }

      getContext(): object {
        return { fillRect: vi.fn() }
      }

      async convertToBlob(): Promise<Blob> {
        return new Blob(['jpeg'], { type: 'image/jpeg' })
      }
    }

    vi.stubGlobal('document', undefined)
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
    vi.stubGlobal('self', {
      addEventListener: (_type: string, listener: (event: MessageEvent) => void) => {
        onMessage = listener
      },
      postMessage
    })
    getDocument.mockImplementation((options) => ({
      promise: Promise.resolve({
        numPages: 1,
        loadingTask: { destroy },
        getPage: vi.fn(async () => ({
          getViewport: ({ scale }: { scale: number }) => ({
            width: 100 * scale,
            height: 50 * scale
          }),
          render: vi.fn(() => {
            const filterFactory = new options.FilterFactory({})
            filterResult = filterFactory.addFilter([new Uint8Array(256)])
            return { promise: Promise.resolve() }
          })
        }))
      })
    }))

    await import('../thumbnail-render.worker')
    onMessage?.(
      new MessageEvent('message', {
        data: {
          id: 'pdf-cover',
          type: 'cover',
          file: new File(['pdf'], 'slides.pdf', { type: 'application/pdf' }),
          mimeType: 'application/pdf'
        }
      })
    )
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled())

    const options = getDocument.mock.calls[0][0]
    expect(options).toMatchObject({
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0
    })
    expect(options.data).toBeInstanceOf(ArrayBuffer)
    const factory = new options.CanvasFactory({})
    const created = factory.create(10, 20)
    expect(created.canvas).toBeInstanceOf(MockOffscreenCanvas)
    expect(created.context).toBeDefined()
    expect(filterResult).toBe('none')
    expect(postMessage).toHaveBeenCalledWith({
      id: 'pdf-cover',
      ok: true,
      blobs: [expect.any(Blob)]
    })
  })
})
