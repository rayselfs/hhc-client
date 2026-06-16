import { cleanupFileResources, type CleanupResult } from './file-resource-cleanup'
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
