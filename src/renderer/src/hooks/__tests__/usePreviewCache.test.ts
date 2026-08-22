import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import type { MediaJobRecord } from '@renderer/lib/media-work-db'
import { usePreviewCache } from '../usePreviewCache'

const {
  mediaJobListeners,
  mockGetFileSource,
  mockGetPdfPageThumbs,
  mockLoadPdfjsLib,
  mockOpenFileExplorerDB,
  mockSavePdfPageThumbBlobs,
  mockSubscribeMediaJobs,
  mockUnsubscribeMediaJobs
} = vi.hoisted(() => {
  const listeners = new Set<(job?: MediaJobRecord) => void>()
  const unsubscribe = vi.fn()
  return {
    mediaJobListeners: listeners,
    mockGetFileSource: vi.fn(),
    mockGetPdfPageThumbs: vi.fn(),
    mockLoadPdfjsLib: vi.fn(),
    mockOpenFileExplorerDB: vi.fn().mockResolvedValue({}),
    mockSavePdfPageThumbBlobs: vi.fn(),
    mockSubscribeMediaJobs: vi.fn((listener: (job?: MediaJobRecord) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        unsubscribe()
      }
    }),
    mockUnsubscribeMediaJobs: unsubscribe
  }
})

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: mockOpenFileExplorerDB,
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/lib/media-work-db', () => ({
  subscribeMediaJobs: mockSubscribeMediaJobs
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getPdfPageThumbs: mockGetPdfPageThumbs,
  savePdfPageThumbBlobs: mockSavePdfPageThumbBlobs
}))

vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsLib: mockLoadPdfjsLib
}))

function makeItem(
  mimeType: string,
  name: string,
  id = 'copy-id',
  sourceBlobId = 'original-id'
): FileItemRecord {
  return {
    id,
    parentId: 'folder-id',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name,
    url: `blob:${sourceBlobId}`,
    size: 1,
    mimeType
  }
}

describe('usePreviewCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mediaJobListeners.clear()
    mockGetPdfPageThumbs.mockResolvedValue([])
    mockSavePdfPageThumbBlobs.mockResolvedValue(undefined)
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument: vi.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 0,
          loadingTask: { destroy: vi.fn() }
        })
      })
    })
    mockGetFileSource.mockResolvedValue({
      url: 'blob:resolved-source',
      revoke: vi.fn()
    })
  })

  it('does not load image or video sources', async () => {
    renderHook(() =>
      usePreviewCache([
        makeItem('image/png', 'image.png', 'image-id'),
        makeItem('video/mp4', 'video.mp4', 'video-id')
      ])
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mockOpenFileExplorerDB).not.toHaveBeenCalled()
    expect(mockGetFileSource).not.toHaveBeenCalled()
    expect(mockLoadPdfjsLib).not.toHaveBeenCalled()
  })

  it('refreshes PDF cache after the durable media job notifies without generating pages', async () => {
    const pdf = makeItem('application/pdf', 'copy.pdf')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mockGetPdfPageThumbs.mockResolvedValueOnce([]).mockResolvedValue(['blob:page-thumb'])

    const { result, unmount } = renderHook(() => usePreviewCache([pdf]))

    await waitFor(() => expect(mockGetPdfPageThumbs).toHaveBeenCalledWith('original-id'))
    expect(result.current.pdfPageThumbs).toEqual({})
    expect(mockSubscribeMediaJobs).toHaveBeenCalledOnce()

    const notify = (job: Partial<MediaJobRecord>): void =>
      mediaJobListeners.forEach((listener) =>
        listener({
          id: 'job-1',
          type: 'pdf-pages',
          sourceBlobId: 'original-id',
          itemId: 'copy-id',
          priority: 0,
          status: 'completed',
          attempt: 1,
          createdAt: 1,
          updatedAt: 2,
          ...job
        })
      )

    act(() => notify({ type: 'video-poster' }))
    act(() => notify({ status: 'running' }))
    await act(async () => Promise.resolve())
    expect(mockGetPdfPageThumbs).toHaveBeenCalledOnce()

    act(() => notify({}))

    await waitFor(() => {
      expect(result.current.pdfPageThumbs).toEqual({ 'copy-id': ['blob:page-thumb'] })
    })
    expect(mockGetPdfPageThumbs).toHaveBeenCalledTimes(2)
    expect(mockGetFileSource).not.toHaveBeenCalled()
    expect(mockLoadPdfjsLib).not.toHaveBeenCalled()
    expect(mockSavePdfPageThumbBlobs).not.toHaveBeenCalled()

    unmount()
    expect(mockUnsubscribeMediaJobs).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:page-thumb')
  })

  it('keeps fulfilled PDF cache entries and cleans their URLs when a sibling read rejects', async () => {
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mockGetPdfPageThumbs.mockImplementation((blobId: string) =>
      blobId === 'source-a'
        ? Promise.resolve(['blob:page-a'])
        : Promise.reject(new Error('cache unavailable'))
    )

    const { result, unmount } = renderHook(() =>
      usePreviewCache([
        makeItem('application/pdf', 'a.pdf', 'item-a', 'source-a'),
        makeItem('application/pdf', 'b.pdf', 'item-b', 'source-b')
      ])
    )

    await waitFor(() => {
      expect(result.current.pdfPageThumbs).toEqual({ 'item-a': ['blob:page-a'] })
    })

    mockGetPdfPageThumbs.mockRejectedValue(new Error('cache unavailable'))
    act(() =>
      mediaJobListeners.forEach((listener) =>
        listener({
          id: 'job-a',
          type: 'pdf-pages',
          sourceBlobId: 'source-a',
          itemId: 'item-a',
          priority: 0,
          status: 'completed',
          attempt: 1,
          createdAt: 1,
          updatedAt: 2
        })
      )
    )
    await act(async () => Promise.resolve())
    expect(result.current.pdfPageThumbs).toEqual({ 'item-a': ['blob:page-a'] })

    unmount()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:page-a')
  })
})
