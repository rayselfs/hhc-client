import type { AnyItemRecord, FileItemRecord, FolderRecord } from '@shared/types/folder'
import { getBlobId } from './blob-identity'
import { isElectron } from './env'
import { openFileExplorerDB } from './file-explorer-db'
import { deleteDerivedAssetsForSource } from './media-work-db'
import { deferMediaResourceCleanup, isMediaResourceLocked } from './media-resource-locks'
import { deletePdfPageThumbs, deleteThumbnail } from './thumbnail-db'

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

async function deleteExternalBlobResources(
  blobId: string,
  storage: 'indexed-db' | 'native-fs' | undefined
): Promise<void> {
  if (storage === 'native-fs' && isElectron()) {
    await window.api.nativeFs.delete(blobId).catch(() => undefined)
  }
  await deleteDerivedAssetsForSource(blobId)
  await deletePdfPageThumbs(blobId)
}

async function finalizeDeferredBlobCleanup(blobId: string): Promise<void> {
  const db = await openFileExplorerDB()
  const tx = db.transaction('file-blobs', 'readwrite')
  const record = await tx.store.get(blobId)
  if (!record || (record.refCount ?? 0) > 0) {
    await tx.done
    return
  }
  await tx.store.delete(blobId)
  await tx.done
  await deleteExternalBlobResources(blobId, record.storage)
}

export async function cleanupFileResources(request: CleanupRequest): Promise<CleanupResult> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(['folder-records', 'folder-items', 'file-blobs'], 'readwrite')
  const folderStore = tx.objectStore('folder-records')
  const itemStore = tx.objectStore('folder-items')
  const blobStore = tx.objectStore('file-blobs')
  const [folders, items] = await Promise.all([folderStore.getAll(), itemStore.getAll()])

  const folderIds = collectDescendantFolderIds(request.folderIds ?? [], folders)
  const requestedItemIds = new Set(request.itemIds ?? [])
  const targetItems = items.filter(
    (item) => requestedItemIds.has(item.id) || folderIds.has(item.parentId)
  )

  const blobReferenceRemovals = new Map<string, number>()
  for (const item of targetItems) {
    if (!isFileItem(item)) continue
    const blobId = getBlobId(item)
    blobReferenceRemovals.set(blobId, (blobReferenceRemovals.get(blobId) ?? 0) + 1)
  }

  const deletedBlobIds: string[] = []
  const deletedBlobStorage = new Map<string, 'indexed-db' | 'native-fs' | undefined>()
  const deferredBlobIds: string[] = []
  for (const [blobId, removedReferences] of blobReferenceRemovals) {
    const record = await blobStore.get(blobId)
    if (!record) continue
    const remainingReferences = (record.refCount ?? 1) - removedReferences
    if (remainingReferences <= 0) {
      if (isMediaResourceLocked(blobId)) {
        await blobStore.put({ ...record, refCount: 0 })
        deferredBlobIds.push(blobId)
      } else {
        await blobStore.delete(blobId)
        deletedBlobIds.push(blobId)
        deletedBlobStorage.set(blobId, record.storage)
      }
    } else {
      await blobStore.put({ ...record, refCount: remainingReferences })
    }
  }

  await Promise.all([
    ...targetItems.map((item) => itemStore.delete(item.id)),
    ...[...folderIds].map((folderId) => folderStore.delete(folderId))
  ])
  await tx.done

  for (const blobId of deferredBlobIds) {
    const deferred = deferMediaResourceCleanup(blobId, () => finalizeDeferredBlobCleanup(blobId))
    if (!deferred) await finalizeDeferredBlobCleanup(blobId)
  }
  await Promise.all([
    ...targetItems.map((item) => deleteThumbnail(item.id)),
    ...deletedBlobIds.map((blobId) =>
      deleteExternalBlobResources(blobId, deletedBlobStorage.get(blobId))
    )
  ])

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
