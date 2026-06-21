import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteSyncCursorsByProviderConnection,
  deleteSyncEntriesByProviderConnection,
  deleteSyncEntryPreferencesByProviderConnection,
  getProviderConnection,
  SYNC_ENTRY_CHANGED_EVENT,
  getSyncCursor,
  getSyncEntryByRemoteItem,
  getSyncEntryPreference,
  listSyncEntriesByProviderConnection,
  putProviderConnection,
  putSyncCursor,
  putSyncEntry,
  putSyncEntryPreference,
  putSyncTombstone,
  resetSyncDBForTests,
  updateSyncDownloadProgress
} from '../sync-db'

describe('sync-db', () => {
  beforeEach(async () => {
    await resetSyncDBForTests()
  })

  it('stores provider connections without credentials or cursors', async () => {
    await putProviderConnection({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive',
      accountLabel: 'user@example.com'
    })

    await expect(getProviderConnection('connection-1')).resolves.toMatchObject({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive',
      accountLabel: 'user@example.com'
    })
    await expect(getProviderConnection('connection-1')).resolves.not.toHaveProperty('accessToken')
    await expect(getProviderConnection('connection-1')).resolves.not.toHaveProperty('deltaLink')
  })

  it('keeps cursors scoped by provider connection and remote folder', async () => {
    await putSyncCursor({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'folder',
      cursor: 'cursor-a',
      updatedAt: 1
    })
    await putSyncCursor({
      providerConnectionId: 'connection-2',
      remoteFolderId: 'folder',
      cursor: 'cursor-b',
      updatedAt: 1
    })

    await expect(getSyncCursor('connection-1', 'folder')).resolves.toMatchObject({
      cursor: 'cursor-a'
    })
    await expect(getSyncCursor('connection-2', 'folder')).resolves.toMatchObject({
      cursor: 'cursor-b'
    })
  })

  it('upserts sync entries by immutable remote identity', async () => {
    const first = await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: 'remote-folder-1',
      kind: 'file',
      name: 'before.mkv',
      mimeType: 'video/x-matroska',
      size: 10,
      status: 'remote-only'
    })
    const second = await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: 'remote-folder-2',
      kind: 'file',
      name: 'after.mkv',
      mimeType: 'video/x-matroska',
      size: 10,
      status: 'available-offline',
      blobId: 'blob-1'
    })

    expect(second.id).toBe(first.id)
    await expect(getSyncEntryByRemoteItem('connection-1', 'remote-file-1')).resolves.toMatchObject({
      parentRemoteItemId: 'remote-folder-2',
      name: 'after.mkv',
      status: 'available-offline',
      blobId: 'blob-1'
    })
  })

  it('dispatches an event when sync entries change', async () => {
    const listener = vi.fn()
    window.addEventListener(SYNC_ENTRY_CHANGED_EVENT, listener)

    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'one.mp4',
      itemId: 'item-1',
      status: 'downloading'
    })

    window.removeEventListener(SYNC_ENTRY_CHANGED_EVENT, listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      detail: {
        providerConnectionId: 'connection-1',
        remoteItemId: 'remote-file-1',
        itemId: 'item-1',
        status: 'downloading'
      }
    })
  })

  it('updates download progress for an existing sync entry', async () => {
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'one.mp4',
      itemId: 'item-1',
      status: 'downloading'
    })

    await updateSyncDownloadProgress(
      { providerConnectionId: 'connection-1', remoteItemId: 'remote-file-1' },
      40,
      100
    )

    await expect(getSyncEntryByRemoteItem('connection-1', 'remote-file-1')).resolves.toMatchObject({
      downloadedBytes: 40,
      downloadTotalBytes: 100
    })
  })

  it('stores per-entry offline policy overrides separately from entries', async () => {
    await putSyncEntryPreference({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      offlinePolicyOverride: 'always-offline'
    })

    await expect(getSyncEntryPreference('connection-1', 'remote-file-1')).resolves.toMatchObject({
      offlinePolicyOverride: 'always-offline'
    })
  })

  it('records tombstones without deleting resources immediately', async () => {
    const tombstone = await putSyncTombstone({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      itemId: 'item-1',
      blobId: 'blob-1',
      reason: 'remote-delete'
    })

    expect(tombstone).toMatchObject({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      itemId: 'item-1',
      blobId: 'blob-1',
      reason: 'remote-delete'
    })
  })

  it('deletes sync metadata scoped to one provider connection', async () => {
    await putSyncCursor({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'folder',
      cursor: 'cursor-a',
      updatedAt: 1
    })
    await putSyncCursor({
      providerConnectionId: 'connection-2',
      remoteFolderId: 'folder',
      cursor: 'cursor-b',
      updatedAt: 1
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'one.mp4',
      status: 'remote-only'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-2',
      remoteItemId: 'remote-file-2',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'two.mp4',
      status: 'remote-only'
    })
    await putSyncEntryPreference({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      offlinePolicyOverride: 'always-offline'
    })

    await deleteSyncEntriesByProviderConnection('connection-1')
    await deleteSyncEntryPreferencesByProviderConnection('connection-1')
    await deleteSyncCursorsByProviderConnection('connection-1')

    await expect(listSyncEntriesByProviderConnection('connection-1')).resolves.toEqual([])
    await expect(getSyncEntryByRemoteItem('connection-2', 'remote-file-2')).resolves.toMatchObject({
      providerConnectionId: 'connection-2'
    })
    await expect(getSyncEntryPreference('connection-1', 'remote-file-1')).resolves.toBeUndefined()
    await expect(getSyncCursor('connection-1', 'folder')).resolves.toBeUndefined()
    await expect(getSyncCursor('connection-2', 'folder')).resolves.toMatchObject({
      cursor: 'cursor-b'
    })
  })
})
