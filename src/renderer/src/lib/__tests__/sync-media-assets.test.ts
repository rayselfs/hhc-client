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

  it('prepares at most three imported media assets concurrently', async () => {
    const db = await openFileExplorerDB()
    const images = Array.from({ length: 5 }, (_, index) => ({
      id: `image-${index}`,
      parentId: 'folder-1',
      type: 'file' as const,
      sortIndex: index,
      createdAt: 1,
      expiresAt: null,
      name: `photo-${index}.png`,
      url: `blob:image-${index}`,
      size: 3,
      mimeType: 'image/png'
    }))
    await Promise.all(
      images.map((item) =>
        db.put('file-blobs', {
          id: item.id,
          blob: new Blob(['png'], { type: 'image/png' }),
          storage: 'indexed-db',
          refCount: 1
        })
      )
    )

    let active = 0
    let maxActive = 0
    const releases: Array<() => void> = []
    mockGenerateThumbnail.mockImplementation(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
      return null
    })

    const refresh = refreshImportedMediaAssets([
      ...Array.from({ length: 3 }, (_, index) => ({
        ...images[index],
        id: `remote-${index}`,
        url: `https://example.com/remote-${index}.png`
      })),
      ...images
    ])

    await vi.waitFor(() => expect(mockGenerateThumbnail).toHaveBeenCalledTimes(3))
    expect(maxActive).toBe(3)

    releases.shift()?.()
    await vi.waitFor(() => expect(mockGenerateThumbnail).toHaveBeenCalledTimes(4))
    releases.shift()?.()
    await vi.waitFor(() => expect(mockGenerateThumbnail).toHaveBeenCalledTimes(5))
    releases.splice(0).forEach((release) => release())

    await refresh
    expect(maxActive).toBe(3)
  })
})
