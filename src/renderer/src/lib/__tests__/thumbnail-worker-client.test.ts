import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface WorkerRequest {
  id: string
  type: 'cover' | 'pdf-pages' | 'cancel'
}

class MockWorker {
  static instances: MockWorker[] = []
  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()
  private readonly listeners = new Map<string, EventListener[]>()

  constructor() {
    MockWorker.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  emit(type: string, event: Event): void {
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }
}

describe('thumbnail worker client', () => {
  beforeEach(() => {
    vi.resetModules()
    MockWorker.instances = []
    vi.stubGlobal('Worker', MockWorker)
    vi.stubGlobal('OffscreenCanvas', class {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders image covers in a background Worker', async () => {
    const { renderCoverThumbnail } = await import('../thumbnail-worker-client')
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
    const result = renderCoverThumbnail(file, file.type)
    const worker = MockWorker.instances[0]
    const request = worker.postMessage.mock.calls[0][0] as WorkerRequest
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' })

    worker.emit(
      'message',
      new MessageEvent('message', { data: { id: request.id, ok: true, blobs: [blob] } })
    )

    await expect(result).resolves.toEqual(blob)
    expect(request.type).toBe('cover')
  })

  it('fails explicitly when background rendering is unavailable', async () => {
    vi.stubGlobal('Worker', undefined)
    const { BackgroundRenderingUnavailableError, renderPdfPageThumbnails } =
      await import('../thumbnail-worker-client')

    await expect(
      renderPdfPageThumbnails(new File(['pdf'], 'slides.pdf', { type: 'application/pdf' }))
    ).rejects.toBeInstanceOf(BackgroundRenderingUnavailableError)
  })

  it('cancels work through the Worker when the job is aborted', async () => {
    const { renderPdfPageThumbnails } = await import('../thumbnail-worker-client')
    const controller = new AbortController()
    const result = renderPdfPageThumbnails(
      new File(['pdf'], 'slides.pdf', { type: 'application/pdf' }),
      controller.signal
    )
    const worker = MockWorker.instances[0]
    const request = worker.postMessage.mock.calls[0][0] as WorkerRequest

    controller.abort()

    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.postMessage).toHaveBeenLastCalledWith({ id: request.id, type: 'cancel' })
  })

  it('maps an unavailable Worker rendering API to the configuration error', async () => {
    const { BackgroundRenderingUnavailableError, renderCoverThumbnail } =
      await import('../thumbnail-worker-client')
    const result = renderCoverThumbnail(new File(['image'], 'photo.jpg'), 'image/jpeg')
    const worker = MockWorker.instances[0]
    const request = worker.postMessage.mock.calls[0][0] as WorkerRequest

    worker.emit(
      'message',
      new MessageEvent('message', {
        data: {
          id: request.id,
          ok: false,
          message: 'createImageBitmap unavailable',
          code: 'background-rendering-unavailable'
        }
      })
    )

    await expect(result).rejects.toBeInstanceOf(BackgroundRenderingUnavailableError)
  })

  it('routes concurrent responses by request ID', async () => {
    const { renderCoverThumbnail } = await import('../thumbnail-worker-client')
    const first = renderCoverThumbnail(new File(['first'], 'first.jpg'), 'image/jpeg')
    const second = renderCoverThumbnail(new File(['second'], 'second.jpg'), 'image/jpeg')
    const worker = MockWorker.instances[0]
    const firstRequest = worker.postMessage.mock.calls[0][0] as WorkerRequest
    const secondRequest = worker.postMessage.mock.calls[1][0] as WorkerRequest
    const firstBlob = new Blob(['first'])
    const secondBlob = new Blob(['second'])

    worker.emit(
      'message',
      new MessageEvent('message', {
        data: { id: secondRequest.id, ok: true, blobs: [secondBlob] }
      })
    )
    worker.emit(
      'message',
      new MessageEvent('message', {
        data: { id: firstRequest.id, ok: true, blobs: [firstBlob] }
      })
    )

    await expect(first).resolves.toBe(firstBlob)
    await expect(second).resolves.toBe(secondBlob)
  })

  it('recreates the Worker after a fatal error', async () => {
    const { renderCoverThumbnail } = await import('../thumbnail-worker-client')
    const failed = renderCoverThumbnail(new File(['first'], 'first.jpg'), 'image/jpeg')
    const firstWorker = MockWorker.instances[0]
    const rejection = expect(failed).rejects.toThrow('Thumbnail Worker failed')

    firstWorker.emit('error', new Event('error'))

    await rejection
    expect(firstWorker.terminate).toHaveBeenCalledOnce()
    void renderCoverThumbnail(new File(['second'], 'second.jpg'), 'image/jpeg')
    expect(MockWorker.instances).toHaveLength(2)
  })
})
