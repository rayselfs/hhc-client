import type { FolderRecord } from '@shared/types/folder'
import { isElectron } from './env'
import { cleanupFileResources, type CleanupResult } from './file-resource-cleanup'
import { openFileExplorerDB } from './file-explorer-db'
import { removeCleanedEntriesFromStore } from '@renderer/stores/file-explorer'
import { cancelSyncDownloads } from './sync-download-queue'
import {
  deleteProviderConnection,
  deleteSyncCursor,
  deleteSyncCursorsByProviderConnection,
  deleteSyncEntries,
  deleteSyncEntriesByProviderConnection,
  deleteSyncEntryPreferences,
  deleteSyncEntryPreferencesByProviderConnection,
  deleteSyncTombstones,
  listHhcLineProviderConnectionsByAccountUser,
  listSyncEntriesByProviderConnection,
  listSyncTombstones,
  putSyncTombstone,
  type SyncEntryRecord,
  type SyncTombstoneRecord
} from './sync-db'

export interface UnlinkSyncConnectionResult extends CleanupResult {
  tombstoneCount: number
}

export interface ConvertSyncedFolderResult {
  folderIds: string[]
  itemIds: string[]
  removedSyncEntryCount: number
}

export interface SyncResourceRecoveryResult extends CleanupResult {
  tombstoneCount: number
}

function collectEntrySubtree(
  entries: SyncEntryRecord[],
  rootRemoteItemId: string
): SyncEntryRecord[] {
  const result = new Set<string>([rootRemoteItemId])
  let changed = true
  while (changed) {
    changed = false
    for (const entry of entries) {
      if (entry.parentRemoteItemId && result.has(entry.parentRemoteItemId)) {
        changed ||= !result.has(entry.remoteItemId)
        result.add(entry.remoteItemId)
      }
    }
  }
  return entries.filter((entry) => result.has(entry.remoteItemId))
}

async function listTombstonesForScope(
  providerConnectionId: string,
  remoteItemIds?: Set<string>
): Promise<SyncTombstoneRecord[]> {
  const tombstones = await listSyncTombstones()
  return tombstones.filter(
    (tombstone) =>
      tombstone.providerConnectionId === providerConnectionId &&
      (!remoteItemIds || remoteItemIds.has(tombstone.remoteItemId))
  )
}

export async function unlinkSyncConnectionFromApp(
  providerConnectionId: string
): Promise<UnlinkSyncConnectionResult> {
  cancelSyncDownloads({ providerConnectionId })
  const entries = await listSyncEntriesByProviderConnection(providerConnectionId)
  const folderIds = entries.flatMap((entry) => (entry.folderId ? [entry.folderId] : []))
  const itemIds = entries.flatMap((entry) => (entry.itemId ? [entry.itemId] : []))

  await Promise.all(
    entries.map((entry) =>
      putSyncTombstone({
        providerConnectionId,
        remoteItemId: entry.remoteItemId,
        itemId: entry.itemId,
        folderId: entry.folderId,
        blobId: entry.blobId,
        reason: 'unlink'
      })
    )
  )

  const tombstones = await listTombstonesForScope(providerConnectionId)
  const cleanupResult = await cleanupFileResources({
    folderIds: [
      ...new Set([
        ...folderIds,
        ...tombstones.flatMap((record) => (record.folderId ? [record.folderId] : []))
      ])
    ],
    itemIds: [
      ...new Set([
        ...itemIds,
        ...tombstones.flatMap((record) => (record.itemId ? [record.itemId] : []))
      ])
    ]
  })
  removeCleanedEntriesFromStore(cleanupResult)

  await deleteSyncEntryPreferencesByProviderConnection(providerConnectionId)
  await deleteSyncCursorsByProviderConnection(providerConnectionId)
  await deleteSyncEntriesByProviderConnection(providerConnectionId)
  await deleteProviderConnection(providerConnectionId)
  await deleteSyncTombstones(tombstones.map((record) => record.id))

  return {
    ...cleanupResult,
    tombstoneCount: entries.length
  }
}

export async function unlinkSyncRootFolderFromApp(
  rootFolder: FolderRecord
): Promise<UnlinkSyncConnectionResult> {
  const syncLink = rootFolder.syncLink
  if (!syncLink) throw new Error('Folder is not a sync root')

  if (syncLink.providerType === 'local-fs') {
    const result = await unlinkSyncConnectionFromApp(syncLink.providerConnectionId)
    if (isElectron() && window.api?.localSync) {
      await window.api.localSync.disconnectFolder(syncLink.providerConnectionId)
    }
    return result
  }

  const entries = await listSyncEntriesByProviderConnection(syncLink.providerConnectionId)
  const targetEntries = collectEntrySubtree(entries, syncLink.remoteFolderId)
  for (const entry of targetEntries) {
    cancelSyncDownloads({
      providerConnectionId: syncLink.providerConnectionId,
      remoteItemId: entry.remoteItemId
    })
  }
  const folderIds = targetEntries.flatMap((entry) => (entry.folderId ? [entry.folderId] : []))
  const itemIds = targetEntries.flatMap((entry) => (entry.itemId ? [entry.itemId] : []))

  await Promise.all(
    targetEntries.map((entry) =>
      putSyncTombstone({
        providerConnectionId: entry.providerConnectionId,
        remoteItemId: entry.remoteItemId,
        itemId: entry.itemId,
        folderId: entry.folderId,
        blobId: entry.blobId,
        reason: 'unlink'
      })
    )
  )

  const tombstones = await listTombstonesForScope(
    syncLink.providerConnectionId,
    new Set(targetEntries.map((entry) => entry.remoteItemId))
  )
  const cleanupResult = await cleanupFileResources({
    folderIds: [
      ...new Set([
        ...folderIds,
        ...tombstones.flatMap((record) => (record.folderId ? [record.folderId] : []))
      ])
    ],
    itemIds: [
      ...new Set([
        ...itemIds,
        ...tombstones.flatMap((record) => (record.itemId ? [record.itemId] : []))
      ])
    ]
  })
  removeCleanedEntriesFromStore(cleanupResult)
  await deleteSyncEntryPreferences(
    syncLink.providerConnectionId,
    targetEntries.map((entry) => entry.remoteItemId)
  )
  await deleteSyncCursor(syncLink.providerConnectionId, syncLink.remoteFolderId)
  await deleteSyncEntries(targetEntries.map((entry) => entry.id))
  await deleteSyncTombstones(tombstones.map((record) => record.id))

  return {
    ...cleanupResult,
    tombstoneCount: targetEntries.length
  }
}

export async function unlinkHhcLineAccountFromApp(accountUserId: string): Promise<void> {
  const connections = await listHhcLineProviderConnectionsByAccountUser(accountUserId)
  for (const connection of connections) {
    await unlinkSyncConnectionFromApp(connection.id)
  }
}

export async function convertSyncConnectionToNormalFolder(
  providerConnectionId: string
): Promise<ConvertSyncedFolderResult> {
  const entries = await listSyncEntriesByProviderConnection(providerConnectionId)
  const unavailable = entries.filter(
    (entry) => entry.kind === 'file' && (entry.status !== 'available-offline' || !entry.blobId)
  )
  if (unavailable.length > 0) {
    throw new Error('Cannot keep synced files before every file is available offline')
  }

  const folderIds = entries.flatMap((entry) => (entry.folderId ? [entry.folderId] : []))
  const itemIds = entries.flatMap((entry) => (entry.itemId ? [entry.itemId] : []))
  const db = await openFileExplorerDB()
  const tx = db.transaction('folder-records', 'readwrite')
  await Promise.all(
    folderIds.map(async (folderId) => {
      const folder = await tx.store.get(folderId)
      if (!folder?.syncLink || folder.syncLink.providerConnectionId !== providerConnectionId) {
        return
      }
      const { syncLink: _syncLink, ...normalFolder } = folder
      await tx.store.put(normalFolder)
    })
  )
  await tx.done

  await Promise.all([
    deleteSyncEntriesByProviderConnection(providerConnectionId),
    deleteSyncEntryPreferencesByProviderConnection(providerConnectionId),
    deleteSyncCursorsByProviderConnection(providerConnectionId),
    deleteProviderConnection(providerConnectionId)
  ])

  return {
    folderIds,
    itemIds,
    removedSyncEntryCount: entries.length
  }
}

export async function recoverPendingSyncResourceCleanups(): Promise<SyncResourceRecoveryResult> {
  const tombstones = await listSyncTombstones()
  if (tombstones.length === 0) {
    return {
      folderIds: [],
      itemIds: [],
      tombstoneCount: 0
    }
  }

  const folderIds = tombstones.flatMap((tombstone) =>
    tombstone.folderId ? [tombstone.folderId] : []
  )
  const itemIds = tombstones.flatMap((tombstone) => (tombstone.itemId ? [tombstone.itemId] : []))
  const cleanupResult =
    folderIds.length > 0 || itemIds.length > 0
      ? await cleanupFileResources({ folderIds, itemIds })
      : { folderIds: [], itemIds: [] }

  await deleteSyncTombstones(tombstones.map((tombstone) => tombstone.id))

  return {
    ...cleanupResult,
    tombstoneCount: tombstones.length
  }
}
