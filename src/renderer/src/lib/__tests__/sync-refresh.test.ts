import { describe, expect, it } from 'vitest'
import type { FolderRecord, FileItemRecord } from '@shared/types/folder'
import type { SyncEntryRecord } from '../sync-db'
import { buildSyncRefreshPlan } from '../sync-refresh'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const rootFolder: FolderRecord = {
  id: 'root-sync-folder',
  name: 'Media',
  parentId: 'file-root',
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null,
  syncLink: {
    providerConnectionId: 'connection-1',
    remoteFolderId: '.',
    providerType: 'local-fs',
    offlinePolicy: 'always-offline'
  }
}

const existingItem: FileItemRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  parentId: rootFolder.id,
  type: 'file',
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null,
  name: 'old.mp4',
  url: 'blob:11111111-1111-4111-8111-111111111111',
  size: 100,
  mimeType: 'video/mp4'
}

const existingEntry: SyncEntryRecord = {
  id: 'entry-1',
  providerConnectionId: 'connection-1',
  remoteItemId: 'old-file',
  parentRemoteItemId: null,
  kind: 'file',
  name: 'old.mp4',
  itemId: existingItem.id,
  blobId: existingItem.id,
  mimeType: 'video/mp4',
  size: 100,
  etag: 'before',
  status: 'available-offline',
  createdAt: 1,
  updatedAt: 1
}

describe('buildSyncRefreshPlan', () => {
  it('updates synced records, queues changed files, and removes missing files', () => {
    const plan = buildSyncRefreshPlan({
      providerConnectionId: 'connection-1',
      providerType: 'local-fs',
      rootFolder,
      rootRemoteFolderId: '.',
      offlinePolicy: 'always-offline',
      platform: 'electron',
      existingFolders: [rootFolder],
      existingItems: [existingItem],
      existingEntries: [existingEntry],
      remoteItems: [
        {
          remoteItemId: 'folder-1',
          parentRemoteItemId: null,
          kind: 'folder',
          name: 'Sunday'
        },
        {
          remoteItemId: 'old-file',
          parentRemoteItemId: 'folder-1',
          kind: 'file',
          name: 'renamed.mp4',
          mimeType: 'video/mp4',
          size: 120,
          etag: 'after'
        },
        {
          remoteItemId: 'bad-file',
          parentRemoteItemId: 'folder-1',
          kind: 'file',
          name: 'legacy.avi',
          size: 20
        }
      ]
    })

    expect(plan.folders).toEqual([
      expect.objectContaining({
        id: 'local-sync-folder-connection-1-folder-1',
        parentId: rootFolder.id,
        name: 'Sunday'
      })
    ])
    expect(plan.items).toEqual([
      expect.objectContaining({
        id: existingItem.id,
        parentId: 'local-sync-folder-connection-1-folder-1',
        name: 'renamed.mp4',
        size: 120,
        url: `blob:${existingItem.id}`
      }),
      expect.objectContaining({
        name: 'legacy.avi',
        url: expect.stringMatching(/^blob:/)
      })
    ])
    const newItem = plan.items.find((item) => item.name === 'legacy.avi')
    expect(newItem?.id).toMatch(UUID_PATTERN)
    expect(plan.fileTransfers).toEqual([
      { itemId: existingItem.id, remoteItemId: 'old-file', mimeType: 'video/mp4' },
      {
        itemId: newItem?.id,
        remoteItemId: 'bad-file',
        mimeType: 'video/x-msvideo'
      }
    ])
    expect(plan.removedItemIds).toEqual([])
  })

  it('marks web-unsupported files disabled and removes entries missing from a full scan', () => {
    const plan = buildSyncRefreshPlan({
      providerConnectionId: 'connection-1',
      providerType: 'local-fs',
      rootFolder,
      rootRemoteFolderId: '.',
      offlinePolicy: 'always-offline',
      platform: 'web',
      existingFolders: [rootFolder],
      existingItems: [existingItem],
      existingEntries: [existingEntry],
      remoteItems: [
        {
          remoteItemId: 'bad-file',
          parentRemoteItemId: null,
          kind: 'file',
          name: 'legacy.avi',
          size: 20
        }
      ]
    })

    expect(plan.items).toEqual([
      expect.objectContaining({
        name: 'legacy.avi',
        url: expect.stringMatching(/^unsupported:/)
      })
    ])
    expect(plan.fileTransfers).toEqual([])
    expect(plan.removedItemIds).toEqual([existingItem.id])
    expect(plan.syncEntries).toEqual([
      expect.objectContaining({
        remoteItemId: 'bad-file',
        status: 'failed'
      })
    ])
  })

  it('replaces legacy non-native item ids before file transfer', () => {
    const legacyItem = { ...existingItem, id: 'local-sync-item-connection-1-old-file' }
    const plan = buildSyncRefreshPlan({
      providerConnectionId: 'connection-1',
      providerType: 'local-fs',
      rootFolder,
      rootRemoteFolderId: '.',
      offlinePolicy: 'always-offline',
      platform: 'electron',
      existingFolders: [rootFolder],
      existingItems: [legacyItem],
      existingEntries: [{ ...existingEntry, itemId: legacyItem.id, blobId: legacyItem.id }],
      remoteItems: [
        {
          remoteItemId: 'old-file',
          parentRemoteItemId: null,
          kind: 'file',
          name: 'old.mp4',
          mimeType: 'video/mp4',
          size: 120,
          etag: 'after'
        }
      ]
    })

    expect(plan.items[0].id).toMatch(UUID_PATTERN)
    expect(plan.items[0].id).not.toBe(legacyItem.id)
    expect(plan.fileTransfers[0].itemId).toBe(plan.items[0].id)
    expect(plan.removedItemIds).toContain(legacyItem.id)
  })
})
