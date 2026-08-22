import { openFileExplorerDB, type ResourceCleanupJournalRecord } from './file-explorer-db'
import { isElectron } from './env'
import { deleteDerivedAssetsForSource } from './media-work-db'
import { deletePdfPageThumbs, deleteThumbnail } from './thumbnail-db'

type ResourceCleanupRecordInput = Omit<
  ResourceCleanupJournalRecord,
  'id' | 'status' | 'attempt' | 'lastError' | 'createdAt' | 'updatedAt'
>

export interface ResourceCleanupRetryResult {
  attempted: number
  failed: number
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500)
  return String(error).slice(0, 500)
}

export function createResourceCleanupRecord(
  input: ResourceCleanupRecordInput
): ResourceCleanupJournalRecord {
  const now = Date.now()
  return {
    ...input,
    id: crypto.randomUUID(),
    status: 'pending',
    attempt: 0,
    createdAt: now,
    updatedAt: now
  }
}

export async function putResourceCleanupRecord(
  record: ResourceCleanupJournalRecord
): Promise<void> {
  const db = await openFileExplorerDB()
  await db.put('resource-cleanup-journal', record)
}

export async function getResourceCleanupRecord(
  id: string
): Promise<ResourceCleanupJournalRecord | undefined> {
  const db = await openFileExplorerDB()
  return db.get('resource-cleanup-journal', id)
}

export async function listResourceCleanupRecords(): Promise<ResourceCleanupJournalRecord[]> {
  const db = await openFileExplorerDB()
  const records = await db.getAll('resource-cleanup-journal')
  return records.sort((a, b) => a.createdAt - b.createdAt)
}

async function processResourceCleanup(record: ResourceCleanupJournalRecord): Promise<void> {
  if (record.deleteNativeFile && record.storage === 'native-fs' && isElectron()) {
    await window.api.nativeFs.delete(record.blobId)
  }
  if (record.deleteDerivedAssets) {
    await deleteDerivedAssetsForSource(record.blobId)
  }
  if (record.deletePdfPageThumbs) {
    await deletePdfPageThumbs(record.blobId)
  }
  for (const itemId of record.itemThumbnailIds) {
    await deleteThumbnail(itemId)
  }
}

export async function retryResourceCleanup(id: string): Promise<void> {
  const db = await openFileExplorerDB()
  const record = await db.get('resource-cleanup-journal', id)
  if (!record) return

  try {
    await processResourceCleanup(record)
    await db.delete('resource-cleanup-journal', id)
  } catch (error) {
    await db.put('resource-cleanup-journal', {
      ...record,
      status: 'failed',
      attempt: record.attempt + 1,
      lastError: getErrorMessage(error),
      updatedAt: Date.now()
    })
    throw error
  }
}

export async function retryPendingResourceCleanups(): Promise<ResourceCleanupRetryResult> {
  const records = await listResourceCleanupRecords()
  let failed = 0
  for (const record of records) {
    try {
      await retryResourceCleanup(record.id)
    } catch {
      failed += 1
    }
  }
  return {
    attempted: records.length,
    failed
  }
}
