import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileProjection from '../FileProjection'

let resizeObserverCallback: ResizeObserverCallback | undefined
let resizeObserverDisconnect = vi.fn()

const {
  mockGetFileSource,
  mockLoadPdfjsLib,
  mockProjectionHandlers,
  mockProjectionSend,
  mockProjectionSetGeneration,
  mockProjectionVlcStop,
  mockReadPresentationArrayBuffer,
  mockOpenPptxViewer
} = vi.hoisted(() => ({
  mockGetFileSource: vi.fn(),
  mockLoadPdfjsLib: vi.fn(),
  mockProjectionHandlers: new Map<string, Array<(data: unknown) => void>>(),
  mockProjectionSend: vi.fn(),
  mockProjectionSetGeneration: vi.fn(),
  mockProjectionVlcStop: vi.fn(),
  mockReadPresentationArrayBuffer: vi.fn(),
  mockOpenPptxViewer: vi.fn()
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsLib: mockLoadPdfjsLib
}))

vi.mock('@renderer/lib/projection-adapter', () => ({
  createProjectionAdapter: () => ({
    setGeneration: mockProjectionSetGeneration,
    getGeneration: vi.fn(() => 4),
    send: mockProjectionSend,
    on: vi.fn((channel: string, handler: (data: unknown) => void) => {
      const handlers = mockProjectionHandlers.get(channel) ?? []
      handlers.push(handler)
      mockProjectionHandlers.set(channel, handlers)
      return () => {
        mockProjectionHandlers.set(
          channel,
          (mockProjectionHandlers.get(channel) ?? []).filter((item) => item !== handler)
        )
      }
    }),
    dispose: vi.fn()
  })
}))

vi.mock('@renderer/lib/presentation-source', () => ({
  readPresentationArrayBuffer: mockReadPresentationArrayBuffer
}))

vi.mock('@renderer/lib/pptx-renderer-service', () => ({
  openPptxViewer: mockOpenPptxViewer
}))

function mockPdf(
  pageCount = 100,
  pendingRenders = false,
  pageSize = { width: 640, height: 360 }
): {
  pdf: {
    numPages: number
    getPage: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }
  renderCancels: Map<number, ReturnType<typeof vi.fn>>
} {
  const renderCancels = new Map<number, ReturnType<typeof vi.fn>>()
  const pdf = {
    numPages: pageCount,
    getPage: vi.fn(async (pageNumber: number) => ({
      getViewport: () => pageSize,
      render: vi.fn(({ canvas }: { canvas: HTMLCanvasElement }) => {
        canvas.dataset.pdfPage = String(pageNumber)
        let rejectRender: ((error: Error) => void) | undefined
        const promise = pendingRenders
          ? new Promise<void>((_resolve, reject) => {
              rejectRender = reject
            })
          : Promise.resolve()
        const cancel = vi.fn(() => {
          const error = new Error('cancelled')
          error.name = 'RenderingCancelledException'
          rejectRender?.(error)
        })
        renderCancels.set(pageNumber, cancel)
        return { promise, cancel }
      })
    })),
    destroy: vi.fn(() => Promise.resolve())
  }
  mockLoadPdfjsLib.mockResolvedValue({
    getDocument: vi.fn(() => ({ promise: Promise.resolve(pdf) }))
  })
  return { pdf, renderCancels }
}

describe('FileProjection copied media identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectionHandlers.clear()
    mockGetFileSource.mockResolvedValue({
      url: 'blob:projection-source',
      revoke: vi.fn()
    })
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 0,
          getPage: vi.fn(),
          destroy: vi.fn(() => Promise.resolve())
        })
      }))
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        projectionVlc: {
          start: vi.fn().mockResolvedValue(undefined),
          control: vi.fn().mockResolvedValue(undefined),
          stop: mockProjectionVlcStop
        }
      }
    })
    mockProjectionVlcStop.mockResolvedValue(undefined)
    mockReadPresentationArrayBuffer.mockResolvedValue(new ArrayBuffer(8))
    mockOpenPptxViewer.mockImplementation(async (_source: ArrayBuffer, container: HTMLElement) => {
      const slide = document.createElement('div')
      slide.dataset.pptxSlide = 'four-by-three'
      slide.style.aspectRatio = '4 / 3'
      container.append(slide)
      return {
        slideCount: 1,
        slideWidth: 1024,
        slideHeight: 768,
        destroy: vi.fn(),
        viewer: { renderSlide: vi.fn().mockResolvedValue(undefined) }
      }
    })
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
    resizeObserverCallback = undefined
    resizeObserverDisconnect = vi.fn()
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = resizeObserverDisconnect
    }
  })

  it('loads projection content with blobId while retaining itemId as UI identity', async () => {
    const { getByAltText } = render(
      <FileProjection
        fileName="copy.png"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="image/png"
      />
    )

    await waitFor(() => {
      expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-id', 'image/png', {
        verifyNativeFile: false
      })
    })
    expect(getByAltText('copy.png')).toHaveAttribute('src', 'blob:projection-source')
  })

  it('applies video seek after metadata is available', async () => {
    const { container, rerender } = render(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'readyState', { configurable: true, value: 0 })
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 })

    rerender(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
        controlEvent={{ id: 1, data: { action: 'seek', itemId: 'copy-id', value: 35 } }}
      />
    )
    expect(video.currentTime).toBe(0)

    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(35)
  })

  it('applies replay seek and volume before resuming a playing video', async () => {
    const { container } = render(
      <FileProjection
        generation={4}
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
        initialReplayState={{
          itemId: 'copy-id',
          positionSeconds: 18,
          durationSeconds: 100,
          isPlaying: true,
          isEnded: false,
          volume: 0.35,
          pdfPage: 1,
          pdfScroll: 0,
          pdfViewMode: 'single',
          zoom: 1,
          pan: { x: 0, y: 0 }
        }}
      />
    )
    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 })
    fireEvent.loadedMetadata(video)

    expect(mockProjectionSetGeneration).toHaveBeenCalledWith(4)
    expect(video.currentTime).toBe(18)
    expect(video.volume).toBe(0.35)
    expect(video.play).toHaveBeenCalled()
  })

  it('passes replay state to embedded VLC startup', async () => {
    render(
      <FileProjection
        generation={4}
        fileName="clip.mkv"
        initialItemId="video-id"
        initialBlobId="video-blob"
        initialMimeType="video/x-matroska"
        initialPlaybackMode="vlc-embedded"
        initialReplayState={{
          itemId: 'video-id',
          positionSeconds: 18,
          durationSeconds: 100,
          isPlaying: true,
          isEnded: false,
          volume: 0.35,
          pdfPage: 1,
          pdfScroll: 0,
          pdfViewMode: 'single',
          zoom: 1,
          pan: { x: 0, y: 0 }
        }}
      />
    )

    await waitFor(() => {
      expect(window.api.projectionVlc.start).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPositionSeconds: 18,
          initialVolume: 0.35,
          initialPlaybackState: 'playing'
        })
      )
    })
  })

  it('uses live stream URLs without loading a stored source and ignores seek controls', async () => {
    const { container, rerender } = render(
      <FileProjection
        fileName="live.mkv"
        initialItemId="live-id"
        initialBlobId="source-id"
        initialMimeType="video/x-matroska"
        initialStreamUrl="hhc-media://native/source-id"
        initialSeekable={false}
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 })

    expect(mockGetFileSource).not.toHaveBeenCalled()
    expect(video).toHaveAttribute('src', 'hhc-media://native/source-id')
    expect(video).toHaveAttribute('preload', 'none')

    rerender(
      <FileProjection
        fileName="live.mkv"
        initialItemId="live-id"
        initialBlobId="source-id"
        initialMimeType="video/x-matroska"
        initialStreamUrl="hhc-media://native/source-id"
        initialSeekable={false}
        controlEvent={{ id: 1, data: { action: 'seek', itemId: 'live-id', value: 35 } }}
      />
    )

    expect(video.currentTime).toBe(0)
  })

  it('reports video playback state from the projection video element', async () => {
    const { container } = render(
      <FileProjection
        fileName="live.mkv"
        initialItemId="live-id"
        initialBlobId="source-id"
        initialMimeType="video/x-matroska"
        initialStreamUrl="hhc-media://native/source-id"
        initialSeekable={false}
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 })
    video.currentTime = 12

    fireEvent.timeUpdate(video)

    expect(mockProjectionSend).toHaveBeenCalledWith('file:playback-state', {
      itemId: 'live-id',
      currentTime: 12,
      duration: 100,
      isPlaying: false,
      isEnded: false
    })
  })

  it('starts live stream playback even before metadata is available', async () => {
    const { container, rerender } = render(
      <FileProjection
        fileName="live.mkv"
        initialItemId="live-id"
        initialBlobId="source-id"
        initialMimeType="video/x-matroska"
        initialStreamUrl="hhc-media://native/source-id"
        initialSeekable={false}
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'readyState', { configurable: true, value: 0 })

    rerender(
      <FileProjection
        fileName="live.mkv"
        initialItemId="live-id"
        initialBlobId="source-id"
        initialMimeType="video/x-matroska"
        initialStreamUrl="hhc-media://native/source-id"
        initialSeekable={false}
        controlEvent={{ id: 1, data: { action: 'play', itemId: 'live-id' } }}
      />
    )

    expect(video.play).toHaveBeenCalledOnce()
  })

  it('applies pending video seek before pending play', async () => {
    const { container, rerender } = render(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'readyState', { configurable: true, value: 0 })
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 })

    rerender(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
        controlEvent={{ id: 1, data: { action: 'seek', itemId: 'copy-id', value: 20 } }}
      />
    )
    rerender(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
        controlEvent={{ id: 2, data: { action: 'play', itemId: 'copy-id' } }}
      />
    )

    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(20)
    expect(video.play).toHaveBeenCalledOnce()
  })

  it('ignores video control commands for a different item', async () => {
    const { container, rerender } = render(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 })

    rerender(
      <FileProjection
        fileName="copy.mp4"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="video/mp4"
        controlEvent={{ id: 1, data: { action: 'seek', itemId: 'other-id', value: 35 } }}
      />
    )

    expect(video.currentTime).toBe(0)
  })

  it('waits for VLC to stop before loading the next non-VLC item', async () => {
    let resolveStop: (() => void) | undefined
    mockProjectionVlcStop.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveStop = resolve
      })
    )

    const { rerender } = render(
      <FileProjection
        fileName="clip.mkv"
        initialItemId="video-id"
        initialBlobId="video-blob"
        initialMimeType="video/x-matroska"
        initialPlaybackMode="vlc-embedded"
      />
    )

    rerender(
      <FileProjection
        fileName="next.png"
        initialItemId="image-id"
        initialBlobId="image-blob"
        initialMimeType="image/png"
      />
    )

    expect(mockProjectionVlcStop).toHaveBeenCalled()
    expect(mockGetFileSource).not.toHaveBeenCalledWith({}, 'image-blob', 'image/png', {
      verifyNativeFile: false
    })

    resolveStop?.()

    await waitFor(() => {
      expect(mockGetFileSource).toHaveBeenCalledWith({}, 'image-blob', 'image/png', {
        verifyNativeFile: false
      })
    })
  })

  it('contains portrait images and native video without a fixed 16:9 frame', async () => {
    const { container, getByAltText, rerender } = render(
      <FileProjection
        fileName="portrait.png"
        initialItemId="portrait-image"
        initialBlobId="portrait-image"
        initialMimeType="image/png"
      />
    )

    const image = await waitFor(() => getByAltText('portrait.png'))
    expect(image).toHaveStyle({ width: '100%', height: '100%', objectFit: 'contain' })
    expect(image.parentElement).toHaveClass('h-screen', 'w-screen')
    expect(image.parentElement?.style.aspectRatio).toBe('')

    rerender(
      <FileProjection
        fileName="portrait.mp4"
        initialItemId="portrait-video"
        initialBlobId="portrait-video"
        initialMimeType="video/mp4"
      />
    )

    const video = await waitFor(() => {
      const element = container.querySelector('video')
      expect(element).not.toBeNull()
      return element!
    })
    expect(video).toHaveStyle({ width: '100%', height: '100%', objectFit: 'contain' })
    expect(video.parentElement).toHaveClass('h-screen', 'w-screen')
    expect(video.parentElement?.style.aspectRatio).toBe('')
  })

  it('contains a 4:3 PDF page using its rendered canvas viewport', async () => {
    mockPdf(1, false, { width: 640, height: 480 })
    const { container } = render(
      <FileProjection
        fileName="four-by-three.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
      />
    )

    const canvas = await waitFor(() => {
      const element = container.querySelector('canvas')
      expect(element).not.toBeNull()
      return element!
    })
    expect(canvas).toHaveAttribute('width', '640')
    expect(canvas).toHaveAttribute('height', '480')
    expect(canvas).toHaveStyle({ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' })
    expect(canvas.closest('.h-screen')).toHaveClass('w-screen')
    expect(canvas.closest('[style*="aspect-ratio"]')).toBeNull()
  })

  it('keeps a 4:3 PPTX slide in its native containment surface', async () => {
    const { container } = render(
      <FileProjection
        fileName="four-by-three.pptx"
        initialItemId="pptx-id"
        initialBlobId="pptx-blob"
        initialMimeType="application/vnd.openxmlformats-officedocument.presentationml.presentation"
      />
    )

    const slide = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('[data-pptx-slide="four-by-three"]')
      expect(element).not.toBeNull()
      return element!
    })
    expect(slide.style.aspectRatio).toBe('4 / 3')
    expect(slide.closest('.h-screen')).toHaveClass('w-screen')
    expect(slide.closest('[style*="aspect-ratio: 16 / 9"]')).toBeNull()
  })

  it('renders only the current PDF page in single mode', async () => {
    const { pdf } = mockPdf()
    const { container } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={{
          itemId: 'pdf-id',
          positionSeconds: 0,
          durationSeconds: 0,
          isPlaying: false,
          isEnded: false,
          volume: 1,
          pdfPage: 50,
          pdfScroll: 49,
          pdfViewMode: 'single',
          zoom: 1,
          pan: { x: 0, y: 0 }
        }}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('canvas')?.dataset.pdfPage).toBe('50')
    })
    expect(pdf.getPage).toHaveBeenCalledTimes(1)
    expect(pdf.getPage).toHaveBeenCalledWith(50)
  })

  it('keeps only pages 48-52 mounted when continuous mode scrolls to page 50', async () => {
    mockPdf()
    const replayState = {
      itemId: 'pdf-id',
      positionSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
      isEnded: false,
      volume: 1,
      pdfPage: 1,
      pdfScroll: 0,
      pdfViewMode: 'continuous' as const,
      zoom: 1,
      pan: { x: 0, y: 0 }
    }
    const { container, rerender } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={replayState}
      />
    )

    const oldCanvas = await waitFor(() => {
      const canvas = container.querySelector<HTMLCanvasElement>('canvas[data-pdf-page="1"]')
      expect(canvas).not.toBeNull()
      return canvas!
    })

    rerender(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={replayState}
        controlEvent={{ id: 1, data: { action: 'pdfScroll', value: 49 } }}
      />
    )

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas')).map(
          (canvas) => canvas.dataset.pdfPage
        )
      ).toEqual(['48', '49', '50', '51', '52'])
    })
    expect(oldCanvas.isConnected).toBe(false)
    expect(container.querySelectorAll('canvas')).toHaveLength(5)
    expect(container.querySelector<HTMLElement>('[data-pdf-spacer="top"]')).toHaveStyle({
      height: '17656px'
    })
  })

  it('cancels continuous PDF renders when their pages leave the window', async () => {
    const { renderCancels } = mockPdf(100, true)
    const replayState = {
      itemId: 'pdf-id',
      positionSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
      isEnded: false,
      volume: 1,
      pdfPage: 1,
      pdfScroll: 0,
      pdfViewMode: 'continuous' as const,
      zoom: 1,
      pan: { x: 0, y: 0 }
    }
    const { rerender } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={replayState}
      />
    )

    await waitFor(() => {
      expect(renderCancels.has(1)).toBe(true)
    })

    rerender(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={replayState}
        controlEvent={{ id: 1, data: { action: 'pdfScroll', value: 49 } }}
      />
    )

    await waitFor(() => {
      expect(renderCancels.get(1)).toHaveBeenCalledOnce()
    })
  })

  it('keeps the newer PDF when the same item loads a different blob', async () => {
    const oldPdf = mockPdf(1).pdf
    const newPdf = mockPdf(1).pdf
    let resolveOldPdf: ((pdf: typeof oldPdf) => void) | undefined
    const oldPdfPromise = new Promise<typeof oldPdf>((resolve) => {
      resolveOldPdf = resolve
    })
    mockGetFileSource.mockImplementation(async (_db, blobId: string) => ({
      url: `blob:${blobId}`,
      revoke: vi.fn()
    }))
    const getDocument = vi.fn((url: string) => ({
      promise: url === 'blob:old-blob' ? oldPdfPromise : Promise.resolve(newPdf)
    }))
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument
    })

    const { rerender } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="old-blob"
        initialMimeType="application/pdf"
      />
    )

    await waitFor(() => {
      expect(getDocument).toHaveBeenCalledWith('blob:old-blob')
    })

    rerender(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="new-blob"
        initialMimeType="application/pdf"
      />
    )

    await waitFor(() => {
      expect(newPdf.getPage).toHaveBeenCalledWith(1)
    })
    await act(async () => {
      resolveOldPdf?.(oldPdf)
      await oldPdfPromise
    })

    await waitFor(() => {
      expect(oldPdf.destroy).toHaveBeenCalledOnce()
    })
    expect(oldPdf.getPage).not.toHaveBeenCalled()
    expect(newPdf.destroy).not.toHaveBeenCalled()
  })

  it('destroys a PDF that resolves after projection unmount', async () => {
    const pdf = mockPdf(1).pdf
    let resolvePdf: ((value: typeof pdf) => void) | undefined
    const pdfPromise = new Promise<typeof pdf>((resolve) => {
      resolvePdf = resolve
    })
    const getDocument = vi.fn(() => ({ promise: pdfPromise }))
    mockLoadPdfjsLib.mockResolvedValue({ getDocument })

    const { unmount } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
      />
    )

    await waitFor(() => {
      expect(getDocument).toHaveBeenCalledWith('blob:projection-source')
    })
    unmount()
    await act(async () => {
      resolvePdf?.(pdf)
      await pdfPromise
    })

    await waitFor(() => {
      expect(pdf.destroy).toHaveBeenCalledOnce()
    })
    expect(pdf.getPage).not.toHaveBeenCalled()
  })

  it('handles a pending getPage rejection after PDF disposal', async () => {
    const { pdf } = mockPdf(1)
    let rejectPage: ((error: Error) => void) | undefined
    const pagePromise = new Promise<never>((_resolve, reject) => {
      rejectPage = reject
    })
    pdf.getPage.mockReturnValue(pagePromise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { unmount } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
      />
    )

    await waitFor(() => {
      expect(pdf.getPage).toHaveBeenCalledWith(1)
    })
    unmount()
    await act(async () => {
      rejectPage?.(new Error('Worker was destroyed'))
      await Promise.resolve()
    })

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('preserves the final page fraction in continuous PDF scroll', async () => {
    mockPdf()
    const { container } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={{
          itemId: 'pdf-id',
          positionSeconds: 0,
          durationSeconds: 0,
          isPlaying: false,
          isEnded: false,
          volume: 1,
          pdfPage: 100,
          pdfScroll: 99.5,
          pdfViewMode: 'continuous',
          zoom: 1,
          pan: { x: 0, y: 0 }
        }}
      />
    )

    await waitFor(() => {
      const scrollContainer = container.querySelector<HTMLElement>('.overflow-y-auto')
      expect(scrollContainer?.scrollTop).toBe(37420)
    })
  })

  it('recomputes continuous PDF spacers and scroll after container resize', async () => {
    const { pdf } = mockPdf()
    const replayState = {
      itemId: 'pdf-id',
      positionSeconds: 0,
      durationSeconds: 0,
      isPlaying: false,
      isEnded: false,
      volume: 1,
      pdfPage: 50,
      pdfScroll: 49,
      pdfViewMode: 'continuous' as const,
      zoom: 1,
      pan: { x: 0, y: 0 }
    }
    const { container, unmount } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
        initialReplayState={replayState}
      />
    )

    const scrollContainer = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('.overflow-y-auto')
      expect(element).not.toBeNull()
      expect(resizeObserverCallback).toBeTypeOf('function')
      expect(pdf.getPage).toHaveBeenCalledTimes(100)
      return element!
    })
    const getPageCallsBeforeResize = pdf.getPage.mock.calls.length
    let containerWidth = 640
    Object.defineProperty(scrollContainer, 'clientWidth', {
      configurable: true,
      get: () => containerWidth
    })

    act(() => resizeObserverCallback?.([], {} as ResizeObserver))
    containerWidth = 320
    act(() => resizeObserverCallback?.([], {} as ResizeObserver))

    await waitFor(() => {
      expect(container.querySelector<HTMLElement>('[data-pdf-spacer="top"]')).toHaveStyle({
        height: '9196px'
      })
      expect(scrollContainer.scrollTop).toBe(9620)
    })
    expect(container.querySelectorAll('canvas')).toHaveLength(5)
    expect(pdf.getPage).toHaveBeenCalledTimes(getPageCallsBeforeResize)

    unmount()
    expect(resizeObserverDisconnect).toHaveBeenCalledOnce()
  })
})
