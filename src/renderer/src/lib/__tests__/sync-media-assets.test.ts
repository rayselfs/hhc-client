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
import { refreshImportedMediaAssets } from '../local-sync-import'

describe('refreshImportedMediaAssets', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetFileExplorerDBForTests()
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    URL.createObjectURL = vi.fn(() => 'blob:test-source')
    URL.revokeObjectURL = vi.fn()
    globalThis.fetch = vi.fn(
      async () => new Response(new Blob(['png'], { type: 'image/png' }), { status: 200 })
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
})
