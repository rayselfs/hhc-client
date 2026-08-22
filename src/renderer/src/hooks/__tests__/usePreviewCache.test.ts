import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
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
  const listeners = new Set<() => void>()
  const unsubscribe = vi.fn()
  return {
    mediaJobListeners: listeners,
    mockGetFileSource: vi.fn(),
    mockGetPdfPageThumbs: vi.fn(),
    mockLoadPdfjsLib: vi.fn(),
    mockOpenFileExplorerDB: vi.fn().mockResolvedValue({}),
    mockSavePdfPageThumbBlobs: vi.fn(),
    mockSubscribeMediaJobs: vi.fn((listener: () => void) => {
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

function makeItem(mimeType: string, name: string, id = 'copy-id'): FileItemRecord {
  return {
    id,
    parentId: 'folder-id',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name,
    url: 'blob:original-id',
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

    act(() => mediaJobListeners.forEach((listener) => listener()))

    await waitFor(() => {
      expect(result.current.pdfPageThumbs).toEqual({ 'copy-id': ['blob:page-thumb'] })
    })
    expect(mockGetFileSource).not.toHaveBeenCalled()
    expect(mockLoadPdfjsLib).not.toHaveBeenCalled()
    expect(mockSavePdfPageThumbBlobs).not.toHaveBeenCalled()

    unmount()
    expect(mockUnsubscribeMediaJobs).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:page-thumb')
  })
})
