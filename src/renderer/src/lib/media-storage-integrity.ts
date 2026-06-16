import type { FileItemRecord } from '@shared/types/folder'
import { getBlobId } from './blob-identity'
import { listFileBlobRecords, openFileExplorerDB } from './file-explorer-db'
import { listDerivedAssets } from './media-work-db'
import { listSyncEntries } from './sync-db'

export type MediaStorageIntegrityIssueKind =
  | 'file-item-missing-blob'
  | 'file-blob-unreferenced'
  | 'derived-asset-missing-source'
  | 'sync-entry-missing-blob'

export interface MediaStorageIntegrityIssue {
  kind: MediaStorageIntegrityIssueKind
  severity: 'warning' | 'error'
  resourceId: string
  relatedId?: string
  message: string
}

export interface MediaStorageIntegrityReport {
  checkedAt: number
  issueCount: number
  issues: MediaStorageIntegrityIssue[]
}

function isFileItem(value: unknown): value is FileItemRecord {
  return typeof value === 'object' && value !== null && (value as FileItemRecord).type === 'file'
}

export async function scanMediaStorageIntegrity(
  now = Date.now()
): Promise<MediaStorageIntegrityReport> {
  const [fileBlobs, derivedAssets, syncEntries, db] = await Promise.all([
    listFileBlobRecords(),
    listDerivedAssets(),
    listSyncEntries(),
    openFileExplorerDB()
  ])
  const folderItems = await db.getAll('folder-items')
  const blobIds = new Set(fileBlobs.map((record) => record.id))
  const referencedBlobIds = new Set<string>()
  const issues: MediaStorageIntegrityIssue[] = []

  for (const item of folderItems) {
    if (!isFileItem(item)) continue
    const blobId = getBlobId(item)
    referencedBlobIds.add(blobId)
    if (!blobIds.has(blobId)) {
      issues.push({
        kind: 'file-item-missing-blob',
        severity: 'error',
        resourceId: item.id,
        relatedId: blobId,
        message: 'File item references a missing source Blob record'
      })
    }
  }

  for (const entry of syncEntries) {
    if (!entry.blobId) continue
    referencedBlobIds.add(entry.blobId)
    if (!blobIds.has(entry.blobId)) {
      issues.push({
        kind: 'sync-entry-missing-blob',
        severity: 'error',
        resourceId: entry.id,
        relatedId: entry.blobId,
        message: 'Sync entry references a missing cached Blob record'
      })
    }
  }

  for (const asset of derivedAssets) {
    if (!blobIds.has(asset.sourceBlobId)) {
      issues.push({
        kind: 'derived-asset-missing-source',
        severity: asset.status === 'ready' ? 'error' : 'warning',
        resourceId: asset.id,
        relatedId: asset.sourceBlobId,
        message: 'Derived asset references a missing source Blob record'
      })
    }
  }

  for (const record of fileBlobs) {
    if ((record.refCount ?? 0) > 0 || referencedBlobIds.has(record.id)) continue
    issues.push({
      kind: 'file-blob-unreferenced',
      severity: 'warning',
      resourceId: record.id,
      message: 'Blob record is not referenced by any file item or sync entry'
    })
  }

  return {
    checkedAt: now,
    issueCount: issues.length,
    issues
  }
}
