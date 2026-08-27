import { describe, expect, it } from 'vitest'
import { deriveSyncFolderHealth } from '../sync-folder-health'
import type { SyncEntryRecord, SyncEntryStatus } from '../sync-db'
import type { FolderRecord } from '@shared/types/folder'

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

function rootFolder(status: 'active' | 'access-revoked' = 'active'): FolderRecord {
  return {
    id: 'sync-root',
    name: 'Sync root',
    parentId: 'file-root',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    syncLink: {
      providerConnectionId: 'connection-1',
      providerType: 'hhc-line',
      remoteFolderId: 'root-remote',
      status
    }
  }
}

describe('deriveSyncFolderHealth', () => {
  it('returns unknown when entries do not include the root folder', () => {
    expect(deriveSyncFolderHealth([], rootFolder())).toMatchObject({ status: 'unknown' })
  })

  it('returns unknown after an access-revoked root disappears', () => {
    expect(deriveSyncFolderHealth([], undefined)).toMatchObject({ status: 'unknown' })
  })

  it('returns a safe error while an access-revoked root still exists', () => {
    const health = deriveSyncFolderHealth([], rootFolder('access-revoked'))

    expect(health).toEqual({
      status: 'error',
      downloadingCount: 0,
      queuedCount: 0,
      failedCount: 0,
      warningCount: 0
    })
    expect(JSON.stringify(health)).not.toMatch(/401|403|authorization|forbidden/i)
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
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'syncing', downloadingCount: 1, queuedCount: 1 })
  })

  it('returns warning for retryable failures', () => {
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
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'warning', failedCount: 1, nextRetryAt: 10_000 })
  })

  it('returns warning for outdated files', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({ remoteItemId: 'root-remote', parentRemoteItemId: null, folderId: 'sync-root' }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          status: 'outdated'
        })
      ],
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'warning', warningCount: 1 })
  })

  it('returns ok when all descendants are remote-only', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({ remoteItemId: 'root-remote', parentRemoteItemId: null, folderId: 'sync-root' }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          status: 'remote-only'
        })
      ],
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'ok', warningCount: 0 })
  })

  it('returns error for fatal failures', () => {
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
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'error', failedCount: 1 })
  })

  it('returns error for insufficient storage', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({ remoteItemId: 'root-remote', parentRemoteItemId: null, folderId: 'sync-root' }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          status: 'insufficient-storage'
        })
      ],
      rootFolder()
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
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'ok', lastSyncedAt: 30 })
  })

  it('does not warn when only folder entries are remote-only', () => {
    const health = deriveSyncFolderHealth(
      [
        entry({
          remoteItemId: 'root-remote',
          parentRemoteItemId: null,
          folderId: 'sync-root',
          kind: 'folder',
          status: 'remote-only'
        }),
        entry({
          remoteItemId: 'file-1',
          parentRemoteItemId: 'root-remote',
          itemId: 'file-1',
          kind: 'file',
          status: 'available-offline'
        })
      ],
      rootFolder()
    )

    expect(health).toMatchObject({ status: 'ok', warningCount: 0 })
  })
})
