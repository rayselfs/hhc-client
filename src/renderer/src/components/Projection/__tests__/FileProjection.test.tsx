import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileProjection from '../FileProjection'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

const { mockGetFileSource, mockProjectionHandlers } = vi.hoisted(() => ({
  mockGetFileSource: vi.fn(),
  mockProjectionHandlers: new Map<string, Array<(data: unknown) => void>>()
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/lib/projection-adapter', () => ({
  createProjectionAdapter: () => ({
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

function triggerProjection<C extends ProjectionChannel>(
  channel: C,
  data: ProjectionPayload<C>
): void {
  for (const handler of mockProjectionHandlers.get(channel) ?? []) {
    handler(data)
  }
}

describe('FileProjection copied media identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectionHandlers.clear()
    mockGetFileSource.mockResolvedValue({
      url: 'blob:projection-source',
      revoke: vi.fn()
    })
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
      expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-id', 'image/png')
    })
    expect(getByAltText('copy.png')).toHaveAttribute('src', 'blob:projection-source')
  })

  it('applies video seek after metadata is available', async () => {
    const { container } = render(
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

    triggerProjection('file:control', { action: 'seek', itemId: 'copy-id', value: 35 })
    expect(video.currentTime).toBe(0)

    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(35)
  })

  it('applies pending video seek before pending play', async () => {
    const { container } = render(
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

    triggerProjection('file:control', { action: 'seek', itemId: 'copy-id', value: 20 })
    triggerProjection('file:control', { action: 'play', itemId: 'copy-id' })

    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(20)
    expect(video.play).toHaveBeenCalledOnce()
  })

  it('ignores video control commands for a different item', async () => {
    const { container } = render(
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

    triggerProjection('file:control', { action: 'seek', itemId: 'other-id', value: 35 })

    expect(video.currentTime).toBe(0)
  })
})
