import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { envState, mockDeleteThumbnail, mockDeletePdfPageThumbs, mockDeleteNativeFile } = vi.hoisted(
  () => ({
    envState: { isElectron: false },
    mockDeleteThumbnail: vi.fn(),
    mockDeletePdfPageThumbs: vi.fn(),
    mockDeleteNativeFile: vi.fn()
  })
)

vi.mock('@renderer/lib/env', () => ({
  isElectron: () => envState.isElectron
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  deleteThumbnail: mockDeleteThumbnail,
  deletePdfPageThumbs: mockDeletePdfPageThumbs
}))

import { cleanupFileResources, purgeExpiredFileTrash } from '../file-resource-cleanup'
import { openFileExplorerDB } from '../file-explorer-db'

const originalBlobId = '123e4567-e89b-12d3-a456-426614174000'
const nativeBlobId = '223e4567-e89b-12d3-a456-426614174000'

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      nativeFs: {
        delete: mockDeleteNativeFile
      }
    }
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  envState.isElectron = false
  mockDeleteNativeFile.mockResolvedValue(undefined)
})

describe('file resource cleanup', () => {
  it('recursively deletes unloaded descendants and their resources from the database', async () => {
    const db = await openFileExplorerDB()
    await db.put('folder-records', {
      id: 'deep-root',
      name: 'Deep',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null
    })
    await db.put('folder-records', {
      id: 'deep-child',
      name: 'Child',
      parentId: 'deep-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null
    })
    await db.put('folder-items', {
      id: 'deep-item',
      parentId: 'deep-child',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'deep.pdf',
      url: `blob:${originalBlobId}`,
      size: 1,
      mimeType: 'application/pdf'
    })
    await db.put('file-blobs', {
      id: originalBlobId,
      blob: new Blob(['pdf']),
      refCount: 1
    })

    const result = await cleanupFileResources({ folderIds: ['deep-root'] })

    expect(result.folderIds).toEqual(expect.arrayContaining(['deep-root', 'deep-child']))
    expect(result.itemIds).toEqual(['deep-item'])
    await expect(db.get('folder-records', 'deep-child')).resolves.toBeUndefined()
    await expect(db.get('folder-items', 'deep-item')).resolves.toBeUndefined()
    await expect(db.get('file-blobs', originalBlobId)).resolves.toBeUndefined()
    expect(mockDeleteThumbnail).toHaveBeenCalledWith('deep-item')
    expect(mockDeletePdfPageThumbs).toHaveBeenCalledWith(originalBlobId)
  })

  it('preserves shared blobs until the final copied item is removed', async () => {
    const db = await openFileExplorerDB()
    for (const id of ['original-item', 'copy-item']) {
      await db.put('folder-items', {
        id,
        parentId: 'file-root',
        type: 'file',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        name: `${id}.png`,
        url: `blob:${originalBlobId}`,
        size: 1,
        mimeType: 'image/png'
      })
    }
    await db.put('file-blobs', {
      id: originalBlobId,
      blob: new Blob(['image']),
      refCount: 2
    })

    await cleanupFileResources({ itemIds: ['original-item'] })
    await expect(db.get('file-blobs', originalBlobId)).resolves.toMatchObject({ refCount: 1 })
    expect(mockDeletePdfPageThumbs).not.toHaveBeenCalled()

    await cleanupFileResources({ itemIds: ['copy-item'] })
    await expect(db.get('file-blobs', originalBlobId)).resolves.toBeUndefined()
    expect(mockDeletePdfPageThumbs).toHaveBeenCalledWith(originalBlobId)
  })

  it('cleans native and legacy storage through the same automatic purge path', async () => {
    envState.isElectron = true
    const db = await openFileExplorerDB()
    await db.put('folder-items', {
      id: 'expired-native',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      deletedAt: 1,
      name: 'native.mp4',
      url: `blob:${nativeBlobId}`,
      size: 1,
      mimeType: 'video/mp4'
    })
    await db.put('file-blobs', {
      id: nativeBlobId,
      storage: 'native-fs',
      size: 1,
      refCount: 1
    })
    await db.put('folder-items', {
      id: 'expired-legacy',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 1,
      createdAt: 1,
      expiresAt: null,
      deletedAt: 1,
      name: 'legacy.png',
      url: 'blob:legacy-blob-id',
      size: 1,
      mimeType: 'image/png'
    })
    await db.put('file-blobs', {
      id: 'legacy-blob-id',
      blob: new Blob(['legacy']),
      refCount: 1
    })

    const result = await purgeExpiredFileTrash(100, 1000)

    expect(result.itemIds).toContain('expired-native')
    expect(mockDeleteNativeFile).toHaveBeenCalledWith(nativeBlobId)
    expect(mockDeleteNativeFile).not.toHaveBeenCalledWith('legacy-blob-id')
    await expect(db.get('folder-items', 'expired-native')).resolves.toBeUndefined()
    await expect(db.get('file-blobs', nativeBlobId)).resolves.toBeUndefined()
  })
})
