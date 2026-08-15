import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import {
  convertSyncConnectionToNormalFolder,
  recoverPendingSyncResourceCleanups,
  unlinkSyncConnectionFromApp,
  unlinkSyncRootFolderFromApp
} from '../sync-unlink'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  getProviderConnection,
  getSyncCursor,
  getSyncEntryByRemoteItem,
  getSyncEntryPreference,
  listSyncEntriesByProviderConnection,
  listSyncTombstones,
  putProviderConnection,
  putSyncCursor,
  putSyncEntry,
  putSyncEntryPreference,
  putSyncTombstone,
  resetSyncDBForTests
} from '../sync-db'

const { mockCleanupFileResources } = vi.hoisted(() => ({
  mockCleanupFileResources: vi.fn()
}))

const { mockCancelSyncDownloads } = vi.hoisted(() => ({
  mockCancelSyncDownloads: vi.fn()
}))

vi.mock('../file-resource-cleanup', () => ({
  cleanupFileResources: mockCleanupFileResources
}))

vi.mock('../sync-download-queue', () => ({
  cancelSyncDownloads: mockCancelSyncDownloads
}))

describe('sync unlink', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetSyncDBForTests()
    await resetFileExplorerDBForTests()
    mockCleanupFileResources.mockResolvedValue({
      folderIds: ['folder-1'],
      itemIds: ['item-1']
    })
  })

  it('removes a sync connection from the app through tombstones and resource cleanup', async () => {
    await putProviderConnection({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive'
    })
    await putSyncCursor({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'root',
      cursor: 'cursor-1',
      updatedAt: 1
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-folder-1',
      parentRemoteItemId: null,
      kind: 'folder',
      name: 'Media',
      folderId: 'folder-1',
      status: 'available-offline'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: 'remote-folder-1',
      kind: 'file',
      name: 'clip.mp4',
      itemId: 'item-1',
      blobId: 'blob-1',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    await putSyncEntryPreference({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      offlinePolicyOverride: 'always-offline'
    })

    const result = await unlinkSyncConnectionFromApp('connection-1')

    expect(mockCleanupFileResources).toHaveBeenCalledWith({
      folderIds: ['folder-1'],
      itemIds: ['item-1']
    })
    expect(result).toEqual({
      folderIds: ['folder-1'],
      itemIds: ['item-1'],
      tombstoneCount: 2
    })
    await expect(getProviderConnection('connection-1')).resolves.toBeUndefined()
    await expect(getSyncCursor('connection-1', 'root')).resolves.toBeUndefined()
    await expect(getSyncEntryByRemoteItem('connection-1', 'remote-file-1')).resolves.toBeUndefined()
    await expect(getSyncEntryPreference('connection-1', 'remote-file-1')).resolves.toBeUndefined()
    await expect(listSyncTombstones()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerConnectionId: 'connection-1',
          remoteItemId: 'remote-folder-1',
          folderId: 'folder-1',
          reason: 'unlink'
        }),
        expect.objectContaining({
          providerConnectionId: 'connection-1',
          remoteItemId: 'remote-file-1',
          itemId: 'item-1',
          blobId: 'blob-1',
          reason: 'unlink'
        })
      ])
    )
    expect(mockCancelSyncDownloads).toHaveBeenCalledWith({ providerConnectionId: 'connection-1' })
  })

  it('disconnects one OneDrive mounted folder without removing the account connection', async () => {
    await putProviderConnection({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive'
    })
    await putSyncCursor({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'root-a',
      cursor: 'cursor-a',
      updatedAt: 1
    })
    await putSyncCursor({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'root-b',
      cursor: 'cursor-b',
      updatedAt: 1
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'root-a',
      parentRemoteItemId: null,
      kind: 'folder',
      name: 'A',
      folderId: 'folder-a',
      status: 'remote-only'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'child-a',
      parentRemoteItemId: 'root-a',
      kind: 'folder',
      name: 'Child',
      folderId: 'folder-child-a',
      status: 'remote-only'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-a',
      parentRemoteItemId: 'child-a',
      kind: 'file',
      name: 'clip.mp4',
      itemId: 'item-a',
      blobId: 'item-a',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'root-b',
      parentRemoteItemId: null,
      kind: 'folder',
      name: 'B',
      folderId: 'folder-b',
      status: 'remote-only'
    })

    await unlinkSyncRootFolderFromApp({
      id: 'folder-a',
      name: 'A',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'connection-1',
        remoteFolderId: 'root-a',
        providerType: 'onedrive'
      }
    })

    expect(mockCleanupFileResources).toHaveBeenCalledWith({
      folderIds: expect.arrayContaining(['folder-a', 'folder-child-a']),
      itemIds: ['item-a']
    })
    expect(mockCancelSyncDownloads).toHaveBeenCalledWith({
      providerConnectionId: 'connection-1',
      remoteItemId: 'root-a'
    })
    expect(mockCancelSyncDownloads).toHaveBeenCalledWith({
      providerConnectionId: 'connection-1',
      remoteItemId: 'child-a'
    })
    expect(mockCancelSyncDownloads).toHaveBeenCalledWith({
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-a'
    })
    await expect(getProviderConnection('connection-1')).resolves.toBeDefined()
    await expect(getSyncCursor('connection-1', 'root-a')).resolves.toBeUndefined()
    await expect(getSyncCursor('connection-1', 'root-b')).resolves.toBeDefined()
    await expect(getSyncEntryByRemoteItem('connection-1', 'root-a')).resolves.toBeUndefined()
    await expect(getSyncEntryByRemoteItem('connection-1', 'root-b')).resolves.toBeDefined()
  })

  it('converts a fully downloaded sync connection into normal local files', async () => {
    await putProviderConnection({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive'
    })
    await putSyncCursor({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'root',
      cursor: 'cursor-1',
      updatedAt: 1
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-folder-1',
      parentRemoteItemId: null,
      kind: 'folder',
      name: 'Media',
      folderId: 'folder-1',
      status: 'available-offline'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: 'remote-folder-1',
      kind: 'file',
      name: 'clip.mp4',
      itemId: 'item-1',
      blobId: 'blob-1',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    await putSyncEntryPreference({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      offlinePolicyOverride: 'always-offline'
    })

    const db = await openFileExplorerDB()
    const folder: FolderRecord = {
      id: 'folder-1',
      name: 'Media',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'connection-1',
        remoteFolderId: 'remote-folder-1',
        providerType: 'onedrive',
        offlinePolicy: 'always-offline'
      }
    }
    const item: FileItemRecord = {
      id: 'item-1',
      parentId: 'folder-1',
      type: 'file',
      name: 'clip.mp4',
      url: 'blob:blob-1',
      size: 1024,
      mimeType: 'video/mp4',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null
    }
    await db.put('folder-records', folder)
    await db.put('folder-items', item)
    await db.put('file-blobs', { id: 'blob-1', storage: 'native-fs', size: 1024, refCount: 1 })

    const result = await convertSyncConnectionToNormalFolder('connection-1')

    expect(result).toEqual({
      folderIds: ['folder-1'],
      itemIds: ['item-1'],
      removedSyncEntryCount: 2
    })
    await expect(db.get('folder-records', 'folder-1')).resolves.toEqual(
      expect.not.objectContaining({ syncLink: expect.anything() })
    )
    await expect(db.get('folder-items', 'item-1')).resolves.toMatchObject({ id: 'item-1' })
    await expect(db.get('file-blobs', 'blob-1')).resolves.toMatchObject({ id: 'blob-1' })
    await expect(getProviderConnection('connection-1')).resolves.toBeUndefined()
    await expect(getSyncCursor('connection-1', 'root')).resolves.toBeUndefined()
    await expect(getSyncEntryByRemoteItem('connection-1', 'remote-file-1')).resolves.toBeUndefined()
    await expect(getSyncEntryPreference('connection-1', 'remote-file-1')).resolves.toBeUndefined()
    await expect(listSyncTombstones()).resolves.toEqual([])
    expect(mockCleanupFileResources).not.toHaveBeenCalled()
  })

  it('rejects keep-files conversion when a synced file is not available offline', async () => {
    await putProviderConnection({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'remote-only.mp4',
      itemId: 'item-1',
      mimeType: 'video/mp4',
      status: 'remote-only'
    })

    await expect(convertSyncConnectionToNormalFolder('connection-1')).rejects.toThrow(
      'Cannot keep synced files before every file is available offline'
    )
    await expect(getProviderConnection('connection-1')).resolves.toBeDefined()
    await expect(listSyncEntriesByProviderConnection('connection-1')).resolves.toHaveLength(1)
  })

  it('recovers pending tombstone cleanup after restart', async () => {
    await putSyncTombstone({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-folder-1',
      folderId: 'folder-1',
      reason: 'unlink'
    })
    await putSyncTombstone({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      itemId: 'item-1',
      blobId: 'blob-1',
      reason: 'remote-delete'
    })

    const result = await recoverPendingSyncResourceCleanups()

    expect(mockCleanupFileResources).toHaveBeenCalledWith({
      folderIds: ['folder-1'],
      itemIds: ['item-1']
    })
    expect(result).toEqual({
      folderIds: ['folder-1'],
      itemIds: ['item-1'],
      tombstoneCount: 2
    })
    await expect(listSyncTombstones()).resolves.toEqual([])
  })

  it('keeps tombstones when restart cleanup fails so the next launch can retry', async () => {
    mockCleanupFileResources.mockRejectedValueOnce(new Error('locked'))
    await putSyncTombstone({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      itemId: 'item-1',
      blobId: 'blob-1',
      reason: 'remote-delete'
    })

    await expect(recoverPendingSyncResourceCleanups()).rejects.toThrow('locked')

    await expect(listSyncTombstones()).resolves.toHaveLength(1)
  })
})
