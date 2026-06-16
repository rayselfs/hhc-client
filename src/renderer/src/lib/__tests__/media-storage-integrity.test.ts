import { beforeEach, describe, expect, it } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { scanMediaStorageIntegrity } from '../media-storage-integrity'
import { putDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import { putSyncEntry, resetSyncDBForTests } from '../sync-db'

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  await resetMediaWorkDBForTests()
  await resetSyncDBForTests()
})

describe('scanMediaStorageIntegrity', () => {
  it('reports file items that reference missing Blob records', async () => {
    const db = await openFileExplorerDB()
    await db.put('folder-items', {
      id: 'item-1',
      parentId: 'root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      size: 10,
      url: 'blob:missing-blob'
    })

    const report = await scanMediaStorageIntegrity(123)

    expect(report).toMatchObject({
      checkedAt: 123,
      issueCount: 1,
      issues: [
        {
          kind: 'file-item-missing-blob',
          severity: 'error',
          resourceId: 'item-1',
          relatedId: 'missing-blob'
        }
      ]
    })
  })

  it('reports derived assets and sync entries whose source Blob is missing', async () => {
    await putDerivedAsset({
      sourceBlobId: 'missing-source',
      kind: 'transcoded-video',
      variant: 'mp4',
      storage: 'native-fs',
      mimeType: 'video/mp4',
      status: 'ready',
      nativeFileId: 'native-output',
      size: 10
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'clip.mp4',
      blobId: 'missing-sync-blob',
      status: 'available-offline'
    })

    const report = await scanMediaStorageIntegrity()

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'derived-asset-missing-source',
          severity: 'error',
          relatedId: 'missing-source'
        }),
        expect.objectContaining({
          kind: 'sync-entry-missing-blob',
          severity: 'error',
          relatedId: 'missing-sync-blob'
        })
      ])
    )
  })

  it('reports unreferenced Blob records without reading Blob contents', async () => {
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'orphan-blob',
      blob: new Blob(['source']),
      size: 6,
      refCount: 0
    })

    const report = await scanMediaStorageIntegrity()

    expect(report.issues).toEqual([
      expect.objectContaining({
        kind: 'file-blob-unreferenced',
        severity: 'warning',
        resourceId: 'orphan-blob'
      })
    ])
  })

  it('does not report healthy referenced media records', async () => {
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'blob-1',
      blob: new Blob(['source']),
      size: 6,
      refCount: 1
    })
    await db.put('folder-items', {
      id: 'item-1',
      parentId: 'root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      size: 6,
      url: 'blob:blob-1'
    })

    const report = await scanMediaStorageIntegrity()

    expect(report.issues).toEqual([])
  })
})
