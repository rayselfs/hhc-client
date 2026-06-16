import { cleanupFileResources, type CleanupResult } from './file-resource-cleanup'
import { openFileExplorerDB } from './file-explorer-db'
import {
  deleteProviderConnection,
  deleteSyncCursorsByProviderConnection,
  deleteSyncEntriesByProviderConnection,
  deleteSyncEntryPreferencesByProviderConnection,
  listSyncEntriesByProviderConnection,
  putSyncTombstone
} from './sync-db'

export interface UnlinkSyncConnectionResult extends CleanupResult {
  tombstoneCount: number
}

export interface ConvertSyncedFolderResult {
  folderIds: string[]
  itemIds: string[]
  removedSyncEntryCount: number
}

export async function unlinkSyncConnectionFromApp(
  providerConnectionId: string
): Promise<UnlinkSyncConnectionResult> {
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

  const cleanupResult = await cleanupFileResources({ folderIds, itemIds })

  await Promise.all([
    deleteSyncEntriesByProviderConnection(providerConnectionId),
    deleteSyncEntryPreferencesByProviderConnection(providerConnectionId),
    deleteSyncCursorsByProviderConnection(providerConnectionId),
    deleteProviderConnection(providerConnectionId)
  ])

  return {
    ...cleanupResult,
    tombstoneCount: entries.length
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
