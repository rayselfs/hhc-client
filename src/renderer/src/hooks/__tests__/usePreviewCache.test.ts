import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import { usePreviewCache } from '../usePreviewCache'

const { mockGetFileSource, mockGetPdfPageThumbs, mockSavePdfPageThumbBlobs } = vi.hoisted(() => ({
  mockGetFileSource: vi.fn(),
  mockGetPdfPageThumbs: vi.fn(),
  mockSavePdfPageThumbBlobs: vi.fn()
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getPdfPageThumbs: mockGetPdfPageThumbs,
  savePdfPageThumbBlobs: mockSavePdfPageThumbBlobs
}))

vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsLib: vi.fn().mockResolvedValue({
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 100, height: 140 }),
          render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
        }),
        loadingTask: { destroy: vi.fn() }
      })
    })
  })
}))

function makeCopiedImage(): FileItemRecord {
  return {
    id: 'copy-id',
    parentId: 'folder-id',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'copy.png',
    url: 'blob:original-id',
    size: 1,
    mimeType: 'image/png'
  }
}

function makeCopiedPdf(): FileItemRecord {
  return {
    ...makeCopiedImage(),
    name: 'copy.pdf',
    mimeType: 'application/pdf'
  }
}

describe('usePreviewCache copied media identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPdfPageThumbs.mockResolvedValue([])
    mockSavePdfPageThumbBlobs.mockResolvedValue(undefined)
    mockGetFileSource.mockResolvedValue({
      url: 'blob:resolved-image',
      revoke: vi.fn()
    })
  })

  it('preloads a copy using the original blob identity', async () => {
    const { result } = renderHook(() => usePreviewCache([makeCopiedImage()]))

    await waitFor(() => {
      expect(result.current.thumbnails['copy-id']).toBe('blob:resolved-image')
    })
    expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-id', 'image/png')
  })

  it('persists runtime PDF thumbnails by blob identity and revokes their URLs', async () => {
    const pageBlob = new Blob(['page'])
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:page-thumb')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(pageBlob))
    mockGetFileSource.mockResolvedValue({
      url: 'hhc-media://file/original-id?type=application%2Fpdf',
      revoke: vi.fn()
    })

    const { result, unmount } = renderHook(() => usePreviewCache([makeCopiedPdf()]))

    await waitFor(() => {
      expect(result.current.pdfPageThumbs['copy-id']).toEqual(['blob:page-thumb'])
    })
    expect(mockGetPdfPageThumbs).toHaveBeenCalledWith('original-id')
    expect(mockSavePdfPageThumbBlobs).toHaveBeenCalledWith('original-id', [pageBlob])
    expect(createObjectUrl).toHaveBeenCalledWith(pageBlob)

    unmount()
    await waitFor(() => {
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:page-thumb')
    })
  })
})
