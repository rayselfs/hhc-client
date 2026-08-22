import { beforeEach, describe, expect, it } from 'vitest'
import { applyRemoteSyncChanges } from '../sync-change-apply'
import {
  getSyncEntryByRemoteItem,
  listSyncTombstones,
  putSyncEntry,
  resetSyncDBForTests
} from '../sync-db'

describe('applyRemoteSyncChanges', () => {
  beforeEach(async () => {
    await resetSyncDBForTests()
  })

  it('creates remote-only entries for new remote files and folders', async () => {
    const result = await applyRemoteSyncChanges({
      providerConnectionId: 'connection-1',
      page: {
        hasMore: false,
        items: [
          {
            remoteItemId: 'folder-1',
            parentRemoteItemId: null,
            kind: 'folder',
            name: 'Media'
          },
          {
            remoteItemId: 'file-1',
            parentRemoteItemId: 'folder-1',
            kind: 'file',
            name: 'clip.mp4',
            mimeType: 'video/mp4',
            size: 1024,
            etag: 'etag-1',
            contentHash: 'hash-1'
          }
        ]
      }
    })

    expect(result.upserted).toHaveLength(2)
    await expect(getSyncEntryByRemoteItem('connection-1', 'file-1')).resolves.toMatchObject({
      parentRemoteItemId: 'folder-1',
      status: 'remote-only',
      mimeType: 'video/mp4'
    })
  })

  it('keeps cached files available when only name or parent changes', async () => {
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-1',
      parentRemoteItemId: 'folder-before',
      kind: 'file',
      name: 'before.mp4',
      itemId: 'item-1',
      blobId: 'blob-1',
      mimeType: 'video/mp4',
      size: 1024,
      etag: 'etag-1',
      contentHash: 'hash-1',
      status: 'available-offline'
    })

    await applyRemoteSyncChanges({
      providerConnectionId: 'connection-1',
      page: {
        hasMore: false,
        items: [
          {
            remoteItemId: 'file-1',
            parentRemoteItemId: 'folder-after',
            kind: 'file',
            name: 'after.mp4',
            mimeType: 'video/mp4',
            size: 1024,
            etag: 'etag-1',
            contentHash: 'hash-1'
          }
        ]
      }
    })

    await expect(getSyncEntryByRemoteItem('connection-1', 'file-1')).resolves.toMatchObject({
      parentRemoteItemId: 'folder-after',
      name: 'after.mp4',
      status: 'available-offline',
      blobId: 'blob-1'
    })
  })

  it('marks cached files outdated when content identity changes', async () => {
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-1',
      parentRemoteItemId: 'folder-1',
      kind: 'file',
      name: 'clip.mp4',
      itemId: 'item-1',
      blobId: 'blob-1',
      mimeType: 'video/mp4',
      size: 1024,
      etag: 'etag-before',
      contentHash: 'hash-before',
      status: 'available-offline'
    })

    await applyRemoteSyncChanges({
      providerConnectionId: 'connection-1',
      page: {
        hasMore: false,
        items: [
          {
            remoteItemId: 'file-1',
            parentRemoteItemId: 'folder-1',
            kind: 'file',
            name: 'clip.mp4',
            mimeType: 'video/mp4',
            size: 2048,
            etag: 'etag-after',
            contentHash: 'hash-after'
          }
        ]
      }
    })

    await expect(getSyncEntryByRemoteItem('connection-1', 'file-1')).resolves.toMatchObject({
      status: 'outdated',
      blobId: 'blob-1',
      etag: 'etag-after',
      contentHash: 'hash-after'
    })
  })

  it('creates tombstones for remote deletes without dropping local blob identity', async () => {
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-1',
      parentRemoteItemId: 'folder-1',
      kind: 'file',
      name: 'clip.mp4',
      itemId: 'item-1',
      blobId: 'blob-1',
      mimeType: 'video/mp4',
      size: 1024,
      status: 'available-offline'
    })

    const result = await applyRemoteSyncChanges({
      providerConnectionId: 'connection-1',
      page: {
        hasMore: false,
        items: [
          {
            remoteItemId: 'file-1',
            parentRemoteItemId: 'folder-1',
            kind: 'file',
            name: 'clip.mp4',
            deleted: true
          }
        ]
      }
    })

    expect(result.tombstonedRemoteItemIds).toEqual(['file-1'])
    await expect(getSyncEntryByRemoteItem('connection-1', 'file-1')).resolves.toMatchObject({
      status: 'deleted-pending-release',
      itemId: 'item-1',
      blobId: 'blob-1'
    })
    await expect(listSyncTombstones()).resolves.toEqual([
      expect.objectContaining({
        providerConnectionId: 'connection-1',
        remoteItemId: 'file-1',
        itemId: 'item-1',
        blobId: 'blob-1',
        reason: 'remote-delete'
      })
    ])
  })
})
