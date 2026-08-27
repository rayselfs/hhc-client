import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  envState,
  mockDeleteThumbnail,
  mockDeletePdfPageThumbs,
  mockDeleteDerivedAssets,
  mockDeleteNativeFile
} = vi.hoisted(() => ({
  envState: { isElectron: false },
  mockDeleteThumbnail: vi.fn(),
  mockDeletePdfPageThumbs: vi.fn(),
  mockDeleteDerivedAssets: vi.fn(),
  mockDeleteNativeFile: vi.fn()
}))

vi.mock('@renderer/lib/env', () => ({
  isElectron: () => envState.isElectron
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  deleteThumbnail: mockDeleteThumbnail,
  deletePdfPageThumbs: mockDeletePdfPageThumbs
}))

vi.mock('@renderer/lib/media-work-db', () => ({
  deleteDerivedAssetsForSource: mockDeleteDerivedAssets,
  listMediaJobs: vi.fn(async () => [])
}))

import {
  cleanupFileResources,
  listFileResourceCleanupItemIds,
  purgeExpiredFileTrash
} from '../file-resource-cleanup'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { lockMediaResources, resetMediaResourceLocksForTests } from '../media-resource-locks'
import {
  listResourceCleanupRecords,
  retryPendingResourceCleanups
} from '../resource-cleanup-journal'

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

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  vi.clearAllMocks()
  resetMediaResourceLocksForTests()
  envState.isElectron = false
  mockDeleteNativeFile.mockResolvedValue(undefined)
})

describe('file resource cleanup', () => {
  it('keeps requested missing item IDs in the poster cancellation closure', async () => {
    await expect(
      listFileResourceCleanupItemIds({ itemIds: ['already-removed-item'] })
    ).resolves.toEqual(['already-removed-item'])
  })

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

    await expect(listFileResourceCleanupItemIds({ folderIds: ['deep-root'] })).resolves.toEqual([
      'deep-item'
    ])
    const result = await cleanupFileResources({ folderIds: ['deep-root'] })

    expect(result.folderIds).toEqual(expect.arrayContaining(['deep-root', 'deep-child']))
    expect(result.itemIds).toEqual(['deep-item'])
    await expect(db.get('folder-records', 'deep-child')).resolves.toBeUndefined()
    await expect(db.get('folder-items', 'deep-item')).resolves.toBeUndefined()
    await expect(db.get('file-blobs', originalBlobId)).resolves.toBeUndefined()
    expect(mockDeleteThumbnail).toHaveBeenCalledWith('deep-item')
    expect(mockDeleteDerivedAssets).toHaveBeenCalledWith(originalBlobId)
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
    expect(mockDeleteDerivedAssets).not.toHaveBeenCalled()
    expect(mockDeletePdfPageThumbs).not.toHaveBeenCalled()
    expect(mockDeleteThumbnail).toHaveBeenCalledWith('original-item')

    await cleanupFileResources({ itemIds: ['copy-item'] })
    await expect(db.get('file-blobs', originalBlobId)).resolves.toBeUndefined()
    expect(mockDeleteDerivedAssets).toHaveBeenCalledWith(originalBlobId)
    expect(mockDeletePdfPageThumbs).toHaveBeenCalledWith(originalBlobId)
  })

  it('defers final source and derived-asset cleanup while projection holds a lock', async () => {
    const release = lockMediaResources([originalBlobId])
    const db = await openFileExplorerDB()
    await db.put('folder-items', {
      id: 'presenting-item',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'presenting.png',
      url: `blob:${originalBlobId}`,
      size: 1,
      mimeType: 'image/png'
    })
    await db.put('file-blobs', {
      id: originalBlobId,
      blob: new Blob(['image']),
      refCount: 1
    })

    await cleanupFileResources({ itemIds: ['presenting-item'] })

    await expect(db.get('file-blobs', originalBlobId)).resolves.toMatchObject({ refCount: 0 })
    expect(mockDeleteDerivedAssets).not.toHaveBeenCalled()

    release()
    await vi.waitFor(async () => {
      await expect(db.get('file-blobs', originalBlobId)).resolves.toBeUndefined()
    })
    expect(mockDeleteDerivedAssets).toHaveBeenCalledWith(originalBlobId)
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

  it('retains failed native cleanup after the catalog transaction commits', async () => {
    envState.isElectron = true
    mockDeleteNativeFile.mockRejectedValueOnce(new Error('native file busy'))
    const db = await openFileExplorerDB()
    await db.put('folder-items', {
      id: 'native-item',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
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

    await expect(cleanupFileResources({ itemIds: ['native-item'] })).rejects.toThrow(
      'native file busy'
    )

    await expect(db.get('folder-items', 'native-item')).resolves.toBeUndefined()
    await expect(db.get('file-blobs', nativeBlobId)).resolves.toBeUndefined()
    await expect(listResourceCleanupRecords()).resolves.toEqual([
      expect.objectContaining({
        blobId: nativeBlobId,
        status: 'failed',
        attempt: 1,
        itemThumbnailIds: ['native-item']
      })
    ])

    await retryPendingResourceCleanups()
    await expect(listResourceCleanupRecords()).resolves.toEqual([])
  })

  it('journals source cleanup only after a projection lock is released', async () => {
    const release = lockMediaResources([originalBlobId])
    const db = await openFileExplorerDB()
    await db.put('folder-items', {
      id: 'locked-item',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'locked.png',
      url: `blob:${originalBlobId}`,
      size: 1,
      mimeType: 'image/png'
    })
    await db.put('file-blobs', {
      id: originalBlobId,
      blob: new Blob(['image']),
      refCount: 1
    })

    await cleanupFileResources({ itemIds: ['locked-item'] })

    await expect(db.get('file-blobs', originalBlobId)).resolves.toMatchObject({ refCount: 0 })
    expect(mockDeleteThumbnail).toHaveBeenCalledWith('locked-item')
    expect(mockDeleteDerivedAssets).not.toHaveBeenCalled()

    release()
    await vi.waitFor(() => {
      expect(mockDeleteDerivedAssets).toHaveBeenCalledWith(originalBlobId)
    })
    await expect(db.get('file-blobs', originalBlobId)).resolves.toBeUndefined()
    await expect(listResourceCleanupRecords()).resolves.toEqual([])
  })
})
