import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import { usePreviewCache } from '../usePreviewCache'

const { mockGetFileSource } = vi.hoisted(() => ({
  mockGetFileSource: vi.fn()
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getPdfPageThumbs: vi.fn().mockResolvedValue([])
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

describe('usePreviewCache copied media identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
