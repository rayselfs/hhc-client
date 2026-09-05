import type { HhcAssetApi } from './hhc-asset-api'
import { getSyncEntryByRemoteItem, openSyncDB, type SyncEntryRecord } from './sync-db'
import type { RemoteSyncItem, SyncDownloadCommitGuard, SyncDownloadRequest } from './sync-provider'

const inFlight = new Set<string>()

export function pendingHhcSyncReceipt(
  request: SyncDownloadRequest,
  metadata: RemoteSyncItem
): SyncEntryRecord['syncReceipt'] {
  const contentVersion = metadata.etag ?? metadata.contentHash
  if (request.offlinePolicy !== 'always-offline' || !contentVersion) return undefined
  return {
    contentVersion,
    appVersion: __APP_VERSION__,
    state: 'pending',
    attempts: 0,
    nextRetryAt: 0
  }
}

export async function retryHhcSyncReceipt(
  api: Pick<HhcAssetApi, 'recordSyncReceipt'>,
  connectionId: string,
  itemId: string,
  canCommit: SyncDownloadCommitGuard,
  now = Date.now()
): Promise<void> {
  const key = `${connectionId}\0${itemId}`
  if (inFlight.has(key)) return
  inFlight.add(key)
  try {
    const entry = await getSyncEntryByRemoteItem(connectionId, itemId)
    const receipt = entry?.syncReceipt
    if (
      !entry ||
      entry.status !== 'available-offline' ||
      !entry.blobId ||
      !receipt ||
      receipt.state !== 'pending' ||
      receipt.nextRetryAt > now ||
      receipt.contentVersion !== (entry.etag ?? entry.contentHash) ||
      !(await canCommit())
    )
      return
    const updated = { ...receipt, attempts: receipt.attempts + 1 }
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        api.recordSyncReceipt({
          collectionItemId: itemId,
          contentVersion: receipt.contentVersion,
          state: 'available-offline',
          appVersion: receipt.appVersion
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new TypeError('Receipt timed out')), 10_000)
        })
      ])
      updated.state = 'acknowledged'
    } catch (error) {
      const classification =
        error && typeof error === 'object' && 'classification' in error
          ? error.classification
          : undefined
      if (classification === 'access-revoked' || classification === 'fatal')
        updated.state = 'rejected'
      else
        updated.nextRetryAt =
          now + Math.min(60_000, 15_000 * 2 ** Math.min(updated.attempts - 1, 2))
    } finally {
      clearTimeout(timeout)
    }
    if (!(await canCommit())) return
    const db = await openSyncDB()
    const tx = db.transaction('sync-entries', 'readwrite')
    const current = await tx.store.get(entry.id)
    if (
      current?.blobId === entry.blobId &&
      current.status === 'available-offline' &&
      current.syncReceipt?.contentVersion === receipt.contentVersion &&
      current.syncReceipt.state === 'pending'
    ) {
      await tx.store.put({ ...current, syncReceipt: updated })
    }
    await tx.done
  } catch {
    // Receipt persistence is telemetry-only; keep downloaded bytes and retry on the next sync.
  } finally {
    inFlight.delete(key)
  }
}
