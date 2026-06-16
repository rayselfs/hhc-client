import { beforeEach, describe, expect, it } from 'vitest'
import {
  getProviderConnection,
  getSyncCursor,
  getSyncEntryByRemoteItem,
  getSyncEntryPreference,
  putProviderConnection,
  putSyncCursor,
  putSyncEntry,
  putSyncEntryPreference,
  putSyncTombstone,
  resetSyncDBForTests
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
})
