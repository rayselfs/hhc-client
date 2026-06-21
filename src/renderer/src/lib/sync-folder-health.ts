import type { SyncEntryRecord } from './sync-db'

export type SyncFolderHealthStatus = 'syncing' | 'warning' | 'error' | 'ok' | 'unknown'

export interface SyncFolderHealth {
  status: SyncFolderHealthStatus
  lastSyncedAt?: number
  downloadingCount: number
  queuedCount: number
  failedCount: number
  warningCount: number
  nextRetryAt?: number
}

function isRetryableFailure(entry: SyncEntryRecord): boolean {
  return (
    entry.status === 'failed' && (entry.errorKind === 'retryable' || entry.errorKind === 'offline')
  )
}

function isErrorEntry(entry: SyncEntryRecord): boolean {
  if (entry.status === 'insufficient-storage') return true
  return entry.status === 'failed' && !isRetryableFailure(entry)
}

function collectRootEntries(entries: SyncEntryRecord[], rootFolderId: string): SyncEntryRecord[] {
  const rootEntry = entries.find((entry) => entry.folderId === rootFolderId)
  if (!rootEntry) return []

  const remoteIds = new Set([rootEntry.remoteItemId])
  let changed = true
  while (changed) {
    changed = false
    for (const entry of entries) {
      if (
        entry.parentRemoteItemId &&
        remoteIds.has(entry.parentRemoteItemId) &&
        !remoteIds.has(entry.remoteItemId)
      ) {
        remoteIds.add(entry.remoteItemId)
        changed = true
      }
    }
  }

  return entries.filter((entry) => remoteIds.has(entry.remoteItemId))
}

export function deriveSyncFolderHealth(
  entries: SyncEntryRecord[],
  rootFolderId: string
): SyncFolderHealth {
  const rootEntries = collectRootEntries(entries, rootFolderId)
  if (rootEntries.length === 0) {
    return {
      status: 'unknown',
      downloadingCount: 0,
      queuedCount: 0,
      failedCount: 0,
      warningCount: 0
    }
  }

  const downloadingCount = rootEntries.filter((entry) => entry.status === 'downloading').length
  const queuedCount = rootEntries.filter((entry) => entry.status === 'queued').length
  const failedCount = rootEntries.filter(
    (entry) => entry.status === 'failed' || entry.status === 'insufficient-storage'
  ).length
  const warningCount = rootEntries.filter(
    (entry) =>
      entry.status === 'remote-only' || entry.status === 'outdated' || isRetryableFailure(entry)
  ).length
  const nextRetryAt = rootEntries
    .map((entry) => entry.nextRetryAt)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)[0]
  const lastSyncedAt = rootEntries
    .map((entry) => entry.updatedAt)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => b - a)[0]

  if (rootEntries.some(isErrorEntry)) {
    return {
      status: 'error',
      lastSyncedAt,
      downloadingCount,
      queuedCount,
      failedCount,
      warningCount,
      nextRetryAt
    }
  }

  if (downloadingCount > 0 || queuedCount > 0) {
    return {
      status: 'syncing',
      lastSyncedAt,
      downloadingCount,
      queuedCount,
      failedCount,
      warningCount,
      nextRetryAt
    }
  }

  if (warningCount > 0) {
    return {
      status: 'warning',
      lastSyncedAt,
      downloadingCount,
      queuedCount,
      failedCount,
      warningCount,
      nextRetryAt
    }
  }

  return {
    status: 'ok',
    lastSyncedAt,
    downloadingCount,
    queuedCount,
    failedCount,
    warningCount,
    nextRetryAt
  }
}
