import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unlinkSyncConnectionFromApp } from '../sync-unlink'
import {
  getProviderConnection,
  getSyncCursor,
  getSyncEntryByRemoteItem,
  getSyncEntryPreference,
  listSyncTombstones,
  putProviderConnection,
  putSyncCursor,
  putSyncEntry,
  putSyncEntryPreference,
  resetSyncDBForTests
} from '../sync-db'

const { mockCleanupFileResources } = vi.hoisted(() => ({
  mockCleanupFileResources: vi.fn()
}))

vi.mock('../file-resource-cleanup', () => ({
  cleanupFileResources: mockCleanupFileResources
}))

describe('sync unlink', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetSyncDBForTests()
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
  })
})
