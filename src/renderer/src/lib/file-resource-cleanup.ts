import type { AnyItemRecord, FileItemRecord, FolderRecord } from '@shared/types/folder'
import { getBlobId } from './blob-identity'
import { isElectron } from './env'
import { openFileExplorerDB } from './file-explorer-db'
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
  const deletedNativeBlobIds: string[] = []
  for (const [blobId, removedReferences] of blobReferenceRemovals) {
    const record = await blobStore.get(blobId)
    if (!record) continue
    const remainingReferences = (record.refCount ?? 1) - removedReferences
    if (remainingReferences <= 0) {
      await blobStore.delete(blobId)
      deletedBlobIds.push(blobId)
      if (record.storage === 'native-fs') deletedNativeBlobIds.push(blobId)
    } else {
      await blobStore.put({ ...record, refCount: remainingReferences })
    }
  }

  await Promise.all([
    ...targetItems.map((item) => itemStore.delete(item.id)),
    ...[...folderIds].map((folderId) => folderStore.delete(folderId))
  ])
  await tx.done

  if (isElectron()) {
    await Promise.all(
      deletedNativeBlobIds.map((blobId) =>
        window.api.nativeFs.delete(blobId).catch(() => undefined)
      )
    )
  }
  await Promise.all([
    ...targetItems.map((item) => deleteThumbnail(item.id)),
    ...deletedBlobIds.map((blobId) => deletePdfPageThumbs(blobId))
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
