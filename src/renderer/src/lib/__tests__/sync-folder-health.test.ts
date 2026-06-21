import { describe, expect, it } from 'vitest'
import { deriveSyncFolderHealth } from '../sync-folder-health'
import type { SyncEntryRecord, SyncEntryStatus } from '../sync-db'

function entry(input: {
  remoteItemId: string
  parentRemoteItemId: string | null
  folderId?: string
  itemId?: string
  kind?: 'folder' | 'file'
  status?: SyncEntryStatus
  errorKind?: SyncEntryRecord['errorKind']
  nextRetryAt?: number
  updatedAt?: number
}): SyncEntryRecord {
  return {
    id: input.remoteItemId,
    providerConnectionId: 'connection-1',
    remoteItemId: input.remoteItemId,
    parentRemoteItemId: input.parentRemoteItemId,
    kind: input.kind ?? 'file',
    name: input.remoteItemId,
    folderId: input.folderId,
    itemId: input.itemId,
    status: input.status ?? 'available-offline',
    errorKind: input.errorKind,
    nextRetryAt: input.nextRetryAt,
    createdAt: 1,
    updatedAt: input.updatedAt ?? 1
  }
}

describe('deriveSyncFolderHealth', () => {
  it('returns unknown when entries do not include the root folder', () => {
    expect(deriveSyncFolderHealth([], 'sync-root')).toMatchObject({ status: 'unknown' })
  })

  it('returns syncing when descendants are queued or downloading', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({ remoteItemId: 'root-remote', parentRemoteItemId: null, folderId: 'sync-root' }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          status: 'downloading'
        }),
        entry({
          remoteItemId: 'file-2',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-2',
          status: 'queued'
        })
      ],
      'sync-root'
    )

    expect(health).toMatchObject({ status: 'syncing', downloadingCount: 1, queuedCount: 1 })
  })

  it('returns warning for remote-only, outdated, or retryable failures', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({ remoteItemId: 'root-remote', parentRemoteItemId: null, folderId: 'sync-root' }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          status: 'failed',
          errorKind: 'retryable',
          nextRetryAt: 10_000
        })
      ],
      'sync-root'
    )

    expect(health).toMatchObject({ status: 'warning', failedCount: 1, nextRetryAt: 10_000 })
  })

  it('returns error for fatal failures or insufficient storage', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({ remoteItemId: 'root-remote', parentRemoteItemId: null, folderId: 'sync-root' }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          status: 'failed',
          errorKind: 'fatal'
        })
      ],
      'sync-root'
    )

    expect(health).toMatchObject({ status: 'error', failedCount: 1 })
  })

  it('returns ok when all descendants are available offline', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({
          remoteItemId: 'root-remote',
          parentRemoteItemId: null,
          folderId: 'sync-root',
          updatedAt: 20
        }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          updatedAt: 30
        })
      ],
      'sync-root'
    )

    expect(health).toMatchObject({ status: 'ok', lastSyncedAt: 30 })
  })
})
