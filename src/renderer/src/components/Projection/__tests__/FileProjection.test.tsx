import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileProjection from '../FileProjection'

const {
  mockGetFileSource,
  mockLoadPdfjsLib,
  mockProjectionHandlers,
  mockProjectionSend,
  mockProjectionVlcStop
} = vi.hoisted(() => ({
  mockGetFileSource: vi.fn(),
  mockLoadPdfjsLib: vi.fn(),
  mockProjectionHandlers: new Map<string, Array<(data: unknown) => void>>(),
  mockProjectionSend: vi.fn(),
  mockProjectionVlcStop: vi.fn()
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
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
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

  it('shows the first PDF page before later pages finish rendering', async () => {
    type MockPdfPage = {
      getViewport: () => { width: number; height: number }
      render: () => { promise: Promise<void> }
    }
    let resolveSecondPage: ((value: MockPdfPage) => void) | undefined
    const makePage = (): MockPdfPage => ({
      getViewport: () => ({ width: 640, height: 360 }),
      render: vi.fn(() => ({ promise: Promise.resolve() }))
    })
    const firstPage = makePage()
    const secondPagePromise = new Promise<MockPdfPage>((resolve) => {
      resolveSecondPage = resolve
    })
    const pdf = {
      numPages: 2,
      getPage: vi.fn((pageNum: number) =>
        pageNum === 1 ? Promise.resolve(firstPage) : secondPagePromise
      ),
      destroy: vi.fn(() => Promise.resolve())
    }
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument: vi.fn(() => ({ promise: Promise.resolve(pdf) }))
    })

    const { container } = render(
      <FileProjection
        fileName="slides.pdf"
        initialItemId="pdf-id"
        initialBlobId="pdf-blob"
        initialMimeType="application/pdf"
      />
    )

    await waitFor(() => {
      expect(container.querySelector('canvas')).not.toBeNull()
    })
    expect(pdf.getPage).toHaveBeenCalledWith(2)

    resolveSecondPage?.(makePage())
    await waitFor(() => {
      expect(pdf.destroy).toHaveBeenCalled()
    })
  })

})
