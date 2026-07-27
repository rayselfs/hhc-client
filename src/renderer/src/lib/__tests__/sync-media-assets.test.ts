import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEnsureSourceMediaMetadata, mockGenerateThumbnail, mockSaveThumbnail } = vi.hoisted(
  () => ({
    mockEnsureSourceMediaMetadata: vi.fn(),
    mockGenerateThumbnail: vi.fn(),
    mockSaveThumbnail: vi.fn()
  })
)

vi.mock('../media-metadata', () => ({
  ensureSourceMediaMetadata: mockEnsureSourceMediaMetadata
}))

vi.mock('../thumbnail-generator', () => ({
  generateThumbnail: mockGenerateThumbnail
}))

vi.mock('../thumbnail-db', () => ({
  saveThumbnail: mockSaveThumbnail
}))

import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { backfillImportedMediaAssets, refreshImportedMediaAssets } from '../local-sync-import'

describe('refreshImportedMediaAssets', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetFileExplorerDBForTests()
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    URL.createObjectURL = vi.fn(() => 'blob:test-source')
    URL.revokeObjectURL = vi.fn()
    globalThis.fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([112, 110, 103]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' }
        })
    )
    mockEnsureSourceMediaMetadata.mockResolvedValue(null)
    mockGenerateThumbnail.mockResolvedValue('data:image/jpeg;base64,thumb')
    mockSaveThumbnail.mockResolvedValue(undefined)
  })

  it('generates thumbnails from Web IndexedDB blobs without nativeFs', async () => {
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'image-1',
      blob: new Blob(['png'], { type: 'image/png' }),
      storage: 'indexed-db',
      refCount: 1
    })

    await refreshImportedMediaAssets([
      {
        id: 'image-1',
        parentId: 'folder-1',
        type: 'file',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        name: 'photo.png',
        url: 'blob:image-1',
        size: 3,
        mimeType: 'image/png'
      }
    ])

    expect(mockGenerateThumbnail).toHaveBeenCalledWith(expect.any(File), 'image/png')
    expect(mockSaveThumbnail).toHaveBeenCalledWith('image-1', 'data:image/jpeg;base64,thumb')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-source')
  })

  it('backfills image and PDF assets only when the local blob exists', async () => {
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'image-1',
      blob: new Blob(['png'], { type: 'image/png' }),
      storage: 'indexed-db',
      refCount: 1
    })
    await db.put('file-blobs', {
      id: 'pdf-1',
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      storage: 'indexed-db',
      refCount: 1
    })
    await db.put('folder-items', {
      id: 'image-1',
      parentId: 'folder-1',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'photo.png',
      url: 'blob:image-1',
      size: 3,
      mimeType: 'image/png'
    })
    await db.put('folder-items', {
      id: 'missing-1',
      parentId: 'folder-1',
      type: 'file',
      sortIndex: 1,
      createdAt: 1,
      expiresAt: null,
      name: 'missing.png',
      url: 'blob:missing-1',
      size: 3,
      mimeType: 'image/png'
    })
    await db.put('folder-items', {
      id: 'pdf-1',
      parentId: 'folder-1',
      type: 'file',
      sortIndex: 2,
      createdAt: 1,
      expiresAt: null,
      name: 'slides.pdf',
      url: 'blob:pdf-1',
      size: 3,
      mimeType: 'application/pdf'
    })

    await backfillImportedMediaAssets()

    expect(mockEnsureSourceMediaMetadata.mock.calls.map((call) => call[0]).sort()).toEqual([
      'image-1',
      'pdf-1'
    ])
    expect(mockGenerateThumbnail.mock.calls.map((call) => call[1])).toEqual([
      'image/png',
      'application/pdf'
    ])
    expect(mockSaveThumbnail).toHaveBeenCalledWith('image-1', 'data:image/jpeg;base64,thumb')
    expect(mockSaveThumbnail).toHaveBeenCalledWith('pdf-1', 'data:image/jpeg;base64,thumb')
  })
})
