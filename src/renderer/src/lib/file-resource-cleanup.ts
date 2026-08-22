import type { AnyItemRecord, FileItemRecord, FolderRecord } from '@shared/types/folder'
import { getBlobId } from './blob-identity'
import { openFileExplorerDB, type ResourceCleanupJournalRecord } from './file-explorer-db'
import { deferMediaResourceCleanup, isMediaResourceLocked } from './media-resource-locks'
import { createResourceCleanupRecord, retryResourceCleanup } from './resource-cleanup-journal'

export interface CleanupResult {
  folderIds: string[]
  itemIds: string[]
}

interface CleanupRequest {
  folderIds?: string[]
  itemIds?: string[]
}

function isFileItem(item: AnyItemRecord): item is FileItemRecord {
  return item.type === 'file'
}

function collectDescendantFolderIds(rootIds: string[], folders: FolderRecord[]): Set<string> {
  const children = new Map<string, string[]>()
  for (const folder of folders) {
    if (folder.parentId === null) continue
    const list = children.get(folder.parentId) ?? []
    list.push(folder.id)
    children.set(folder.parentId, list)
  }

  const result = new Set(rootIds)
  const queue = [...rootIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const childId of children.get(id) ?? []) {
      if (result.has(childId)) continue
      result.add(childId)
      queue.push(childId)
    }
  }
  return result
}

function makeCleanupRecord(
  blobId: string,
  storage: 'indexed-db' | 'native-fs' | undefined,
  itemThumbnailIds: string[],
  deleteSourceResources: boolean
): ResourceCleanupJournalRecord {
  return createResourceCleanupRecord({
    blobId,
    storage,
    deleteNativeFile: deleteSourceResources && storage === 'native-fs',
    deleteDerivedAssets: deleteSourceResources,
    deletePdfPageThumbs: deleteSourceResources,
    itemThumbnailIds
  })
}

async function finalizeDeferredBlobCleanup(blobId: string): Promise<void> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(['file-blobs', 'resource-cleanup-journal'], 'readwrite')
  const blobStore = tx.objectStore('file-blobs')
  const journalStore = tx.objectStore('resource-cleanup-journal')
  const record = await blobStore.get(blobId)
  if (!record || (record.refCount ?? 0) > 0) {
    await tx.done
    return
  }
  const cleanupRecord = makeCleanupRecord(blobId, record.storage, [], true)
  await blobStore.delete(blobId)
  await journalStore.put(cleanupRecord)
  await tx.done
  await retryResourceCleanup(cleanupRecord.id)
}

export async function cleanupFileResources(request: CleanupRequest): Promise<CleanupResult> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(
    ['folder-records', 'folder-items', 'file-blobs', 'resource-cleanup-journal'],
    'readwrite'
  )
  const folderStore = tx.objectStore('folder-records')
  const itemStore = tx.objectStore('folder-items')
  const blobStore = tx.objectStore('file-blobs')
  const journalStore = tx.objectStore('resource-cleanup-journal')
  const [folders, items] = await Promise.all([folderStore.getAll(), itemStore.getAll()])

  const folderIds = collectDescendantFolderIds(request.folderIds ?? [], folders)
  const requestedItemIds = new Set(request.itemIds ?? [])
  const targetItems = items.filter(
    (item) => requestedItemIds.has(item.id) || folderIds.has(item.parentId)
  )

  const blobReferenceRemovals = new Map<string, number>()
  const thumbnailIdsByBlob = new Map<string, string[]>()
  const nonFileThumbnailIds: string[] = []
  for (const item of targetItems) {
    if (!isFileItem(item)) {
      nonFileThumbnailIds.push(item.id)
      continue
    }
    const blobId = getBlobId(item)
    blobReferenceRemovals.set(blobId, (blobReferenceRemovals.get(blobId) ?? 0) + 1)
    thumbnailIdsByBlob.set(blobId, [...(thumbnailIdsByBlob.get(blobId) ?? []), item.id])
  }

  const deferredBlobIds: string[] = []
  const cleanupRecords: ResourceCleanupJournalRecord[] = []
  for (const [blobId, removedReferences] of blobReferenceRemovals) {
    const record = await blobStore.get(blobId)
    const itemThumbnailIds = thumbnailIdsByBlob.get(blobId) ?? []
    if (!record) {
      cleanupRecords.push(makeCleanupRecord(blobId, undefined, itemThumbnailIds, true))
      continue
    }
    const remainingReferences = (record.refCount ?? 1) - removedReferences
    if (remainingReferences <= 0) {
      if (isMediaResourceLocked(blobId)) {
        await blobStore.put({ ...record, refCount: 0 })
        deferredBlobIds.push(blobId)
        cleanupRecords.push(makeCleanupRecord(blobId, record.storage, itemThumbnailIds, false))
      } else {
        await blobStore.delete(blobId)
        cleanupRecords.push(makeCleanupRecord(blobId, record.storage, itemThumbnailIds, true))
      }
    } else {
      await blobStore.put({ ...record, refCount: remainingReferences })
      cleanupRecords.push(makeCleanupRecord(blobId, record.storage, itemThumbnailIds, false))
    }
  }
  cleanupRecords.push(
    ...nonFileThumbnailIds.map((itemId) => makeCleanupRecord(itemId, undefined, [itemId], false))
  )

  await Promise.all([
    ...targetItems.map((item) => itemStore.delete(item.id)),
    ...[...folderIds].map((folderId) => folderStore.delete(folderId)),
    ...cleanupRecords.map((record) => journalStore.put(record))
  ])
  await tx.done

  for (const blobId of deferredBlobIds) {
    const deferred = deferMediaResourceCleanup(blobId, () => finalizeDeferredBlobCleanup(blobId))
    if (!deferred) await finalizeDeferredBlobCleanup(blobId)
  }
  await Promise.all(cleanupRecords.map((record) => retryResourceCleanup(record.id)))

  return {
    folderIds: [...folderIds],
    itemIds: targetItems.map((item) => item.id)
  }
}

export async function purgeExpiredFileTrash(
  retentionMs: number,
  now = Date.now()
): Promise<CleanupResult> {
  const db = await openFileExplorerDB()
  const cutoff = now - retentionMs
  const [folders, items] = await Promise.all([
    db.getAll('folder-records'),
    db.getAll('folder-items')
  ])
  return cleanupFileResources({
    folderIds: folders
      .filter((folder) => folder.deletedAt != null && folder.deletedAt < cutoff)
      .map((folder) => folder.id),
    itemIds: items
      .filter((item) => item.deletedAt != null && item.deletedAt < cutoff)
      .map((item) => item.id)
  })
}
