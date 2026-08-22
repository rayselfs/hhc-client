import type { RemoteSyncItem, SyncChangePage } from './sync-provider'
import {
  getSyncEntryByRemoteItem,
  putSyncEntry,
  putSyncTombstone,
  type SyncEntryRecord,
  type SyncEntryStatus
} from './sync-db'

export interface ApplyRemoteSyncChangesInput {
  providerConnectionId: string
  page: SyncChangePage
}

export interface ApplyRemoteSyncChangesResult {
  upserted: SyncEntryRecord[]
  tombstonedRemoteItemIds: string[]
}

function contentIdentityChanged(existing: SyncEntryRecord, item: RemoteSyncItem): boolean {
  if (existing.kind !== 'file' || item.kind !== 'file') return false
  if (item.etag && existing.etag && item.etag !== existing.etag) return true
  if (item.contentHash && existing.contentHash && item.contentHash !== existing.contentHash) {
    return true
  }
  if (
    typeof item.size === 'number' &&
    typeof existing.size === 'number' &&
    item.size !== existing.size
  ) {
    return true
  }
  return false
}

function resolveNextStatus(
  existing: SyncEntryRecord | undefined,
  item: RemoteSyncItem
): SyncEntryStatus {
  if (!existing) return 'remote-only'
  if (existing.status === 'failed' || existing.status === 'insufficient-storage')
    return existing.status
  if (contentIdentityChanged(existing, item)) return existing.blobId ? 'outdated' : 'remote-only'
  return existing.status
}

export async function applyRemoteSyncChanges(
  input: ApplyRemoteSyncChangesInput
): Promise<ApplyRemoteSyncChangesResult> {
  const upserted: SyncEntryRecord[] = []
  const tombstonedRemoteItemIds: string[] = []

  for (const item of input.page.items) {
    const existing = await getSyncEntryByRemoteItem(input.providerConnectionId, item.remoteItemId)

    if (item.deleted) {
      await putSyncTombstone({
        providerConnectionId: input.providerConnectionId,
        remoteItemId: item.remoteItemId,
        itemId: existing?.itemId,
        folderId: existing?.folderId,
        blobId: existing?.blobId,
        reason: 'remote-delete'
      })
      await putSyncEntry({
        providerConnectionId: input.providerConnectionId,
        remoteItemId: item.remoteItemId,
        parentRemoteItemId: item.parentRemoteItemId,
        kind: item.kind,
        name: item.name,
        itemId: existing?.itemId,
        folderId: existing?.folderId,
        blobId: existing?.blobId,
        mimeType: item.mimeType ?? existing?.mimeType,
        size: item.size ?? existing?.size,
        etag: item.etag ?? existing?.etag,
        contentHash: item.contentHash ?? existing?.contentHash,
        status: 'deleted-pending-release'
      })
      tombstonedRemoteItemIds.push(item.remoteItemId)
      continue
    }

    const entry = await putSyncEntry({
      providerConnectionId: input.providerConnectionId,
      remoteItemId: item.remoteItemId,
      parentRemoteItemId: item.parentRemoteItemId,
      kind: item.kind,
      name: item.name,
      itemId: existing?.itemId,
      folderId: existing?.folderId,
      blobId: existing?.blobId,
      mimeType: item.mimeType ?? existing?.mimeType,
      size: item.size,
      etag: item.etag,
      contentHash: item.contentHash,
      status: resolveNextStatus(existing, item)
    })
    upserted.push(entry)
  }

  return { upserted, tombstonedRemoteItemIds }
}
