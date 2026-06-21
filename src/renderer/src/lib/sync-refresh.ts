import type {
  FileItemRecord,
  FolderRecord,
  SyncOfflinePolicy,
  SyncProviderType
} from '@shared/types/folder'
import { isValidNativeFileId } from '@shared/native-media'
import { FILE_EXPLORER_ROOT_ID, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { cleanupFileResources } from './file-resource-cleanup'
import { openFileExplorerDB, type FileBlobRecord } from './file-explorer-db'
import type { MediaPlatform } from '@renderer/lib/media-capabilities'
import { classifyMediaImport } from '@renderer/lib/media-import-policy'
import { isIgnoredSystemPath } from '@shared/file-ignore-policy'
import type { RemoteSyncItem } from './sync-provider'
import {
  putSyncEntry,
  putSyncTombstone,
  type SyncEntryRecord,
  type SyncEntryStatus
} from './sync-db'

export interface SyncFileTransfer {
  itemId: string
  remoteItemId: string
  mimeType: string
}

export interface SyncRefreshPlan {
  folders: FolderRecord[]
  items: FileItemRecord[]
  syncEntries: Array<Omit<SyncEntryRecord, 'id' | 'createdAt' | 'updatedAt'>>
  fileTransfers: SyncFileTransfer[]
  removedFolderIds: string[]
  removedItemIds: string[]
  removedEntries: SyncEntryRecord[]
  disabledCount: number
}

interface BuildSyncRefreshPlanInput {
  providerConnectionId: string
  providerType: SyncProviderType
  rootFolder: FolderRecord
  rootRemoteFolderId: string
  offlinePolicy: SyncOfflinePolicy
  platform: MediaPlatform
  existingFolders: FolderRecord[]
  existingItems: FileItemRecord[]
  existingEntries: SyncEntryRecord[]
  remoteItems: RemoteSyncItem[]
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_')
}

function sortByIndex<T extends { sortIndex: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.sortIndex - b.sortIndex)
}

function createFolderId(
  providerType: SyncProviderType,
  connectionId: string,
  remoteItemId: string
): string {
  const prefix = providerType === 'onedrive' ? 'onedrive' : 'local-sync'
  return `${prefix}-folder-${safeIdPart(connectionId)}-${safeIdPart(remoteItemId)}`
}

function createItemId(): string {
  return crypto.randomUUID()
}

function classifyRemoteFile(
  item: RemoteSyncItem,
  platform: MediaPlatform
): { mimeType: string; disabled: boolean; skip: boolean } {
  const decision = classifyMediaImport({ name: item.name, mimeType: item.mimeType }, platform)
  if (decision.action === 'skip') return { mimeType: decision.mimeType, disabled: true, skip: true }
  return {
    mimeType: decision.mimeType,
    disabled: decision.action === 'platform-unsupported',
    skip: false
  }
}

function contentChanged(existing: SyncEntryRecord | undefined, item: RemoteSyncItem): boolean {
  if (!existing || item.kind !== 'file') return true
  if (item.etag && existing.etag && item.etag !== existing.etag) return true
  if (item.contentHash && existing.contentHash && item.contentHash !== existing.contentHash) {
    return true
  }
  if (
    typeof item.size === 'number' &&
    typeof existing.size === 'number' &&
    item.size !== existing.size
  ) {
    return true
  }
  return !existing.blobId || existing.status === 'failed' || existing.status === 'outdated'
}

function nextStatus(
  disabled: boolean,
  offlinePolicy: SyncOfflinePolicy,
  shouldTransfer: boolean
): SyncEntryStatus {
  if (disabled) return 'remote-only'
  if (offlinePolicy === 'always-offline') return shouldTransfer ? 'queued' : 'available-offline'
  return 'remote-only'
}

export function buildSyncRefreshPlan(input: BuildSyncRefreshPlanInput): SyncRefreshPlan {
  const now = Date.now()
  const existingByRemoteId = new Map(
    input.existingEntries.map((entry) => [entry.remoteItemId, entry])
  )
  const remoteIds = new Set<string>([input.rootRemoteFolderId])
  const remoteFolderToLocalId = new Map<string | null, string>([
    [null, input.rootFolder.id],
    [input.rootRemoteFolderId, input.rootFolder.id]
  ])
  const folderSortCounts = new Map<string, number>()
  const itemSortCounts = new Map<string, number>()
  const folders: FolderRecord[] = []
  const items: FileItemRecord[] = []
  const syncEntries: SyncRefreshPlan['syncEntries'] = []
  const fileTransfers: SyncFileTransfer[] = []
  const replacedItemIds: string[] = []
  const ignoredRemoteIds = new Set<string>()
  let disabledCount = 0

  for (const remoteItem of input.remoteItems) {
    if (
      isIgnoredSystemPath(remoteItem.name) ||
      (remoteItem.parentRemoteItemId && ignoredRemoteIds.has(remoteItem.parentRemoteItemId))
    ) {
      ignoredRemoteIds.add(remoteItem.remoteItemId)
      continue
    }
    if (remoteItem.deleted || remoteItem.kind !== 'folder') continue
    remoteIds.add(remoteItem.remoteItemId)
    if (remoteItem.remoteItemId === input.rootRemoteFolderId) continue
    const parentId = remoteFolderToLocalId.get(remoteItem.parentRemoteItemId) ?? input.rootFolder.id
    const existing = existingByRemoteId.get(remoteItem.remoteItemId)
    const folderId =
      existing?.folderId ??
      createFolderId(input.providerType, input.providerConnectionId, remoteItem.remoteItemId)
    const sortIndex = folderSortCounts.get(parentId) ?? 0
    folderSortCounts.set(parentId, sortIndex + 1)
    folders.push({
      id: folderId,
      name: remoteItem.name,
      parentId,
      sortIndex,
      createdAt: input.existingFolders.find((folder) => folder.id === folderId)?.createdAt ?? now,
      expiresAt: null,
      syncLink: {
        providerConnectionId: input.providerConnectionId,
        remoteFolderId: remoteItem.remoteItemId,
        providerType: input.providerType,
        offlinePolicy: input.offlinePolicy
      }
    })
    remoteFolderToLocalId.set(remoteItem.remoteItemId, folderId)
    syncEntries.push({
      providerConnectionId: input.providerConnectionId,
      remoteItemId: remoteItem.remoteItemId,
      parentRemoteItemId: remoteItem.parentRemoteItemId,
      kind: 'folder',
      name: remoteItem.name,
      folderId,
      status: input.offlinePolicy === 'always-offline' ? 'available-offline' : 'remote-only'
    })
  }

  for (const remoteItem of input.remoteItems) {
    if (ignoredRemoteIds.has(remoteItem.remoteItemId)) continue
    if (remoteItem.deleted || remoteItem.kind !== 'file') continue
    const policy = classifyRemoteFile(remoteItem, input.platform)
    if (policy.skip) continue
    remoteIds.add(remoteItem.remoteItemId)
    const parentId = remoteFolderToLocalId.get(remoteItem.parentRemoteItemId) ?? input.rootFolder.id
    const existing = existingByRemoteId.get(remoteItem.remoteItemId)
    const itemId =
      existing?.itemId && isValidNativeFileId(existing.itemId) ? existing.itemId : createItemId()
    if (existing?.itemId && existing.itemId !== itemId) replacedItemIds.push(existing.itemId)
    const sortIndex = itemSortCounts.get(parentId) ?? 0
    itemSortCounts.set(parentId, sortIndex + 1)
    const shouldTransfer =
      !policy.disabled &&
      input.offlinePolicy === 'always-offline' &&
      contentChanged(existing, remoteItem)
    const status = nextStatus(policy.disabled, input.offlinePolicy, shouldTransfer)
    if (policy.disabled) disabledCount++
    items.push({
      id: itemId,
      parentId,
      type: 'file',
      sortIndex,
      createdAt: input.existingItems.find((item) => item.id === itemId)?.createdAt ?? now,
      expiresAt: null,
      name: remoteItem.name,
      url: policy.disabled ? `unsupported:${itemId}` : `blob:${itemId}`,
      size: remoteItem.size ?? 0,
      mimeType: policy.mimeType
    })
    if (shouldTransfer) {
      fileTransfers.push({
        itemId,
        remoteItemId: remoteItem.remoteItemId,
        mimeType: policy.mimeType
      })
    }
    syncEntries.push({
      providerConnectionId: input.providerConnectionId,
      remoteItemId: remoteItem.remoteItemId,
      parentRemoteItemId: remoteItem.parentRemoteItemId,
      kind: 'file',
      name: remoteItem.name,
      itemId,
      blobId: policy.disabled ? undefined : itemId,
      mimeType: policy.mimeType,
      size: remoteItem.size,
      etag: remoteItem.etag,
      contentHash: remoteItem.contentHash,
      status
    })
  }

  const removedEntries = input.existingEntries.filter(
    (entry) =>
      entry.status !== 'deleted-pending-release' &&
      entry.remoteItemId !== input.rootRemoteFolderId &&
      !remoteIds.has(entry.remoteItemId)
  )

  return {
    folders,
    items,
    syncEntries,
    fileTransfers,
    removedFolderIds: removedEntries
      .filter((entry) => entry.kind === 'folder' && entry.folderId)
      .map((entry) => entry.folderId!),
    removedItemIds: [
      ...replacedItemIds,
      ...removedEntries
        .filter((entry) => entry.kind === 'file' && entry.itemId)
        .map((entry) => entry.itemId!)
    ],
    removedEntries,
    disabledCount
  }
}

export async function applySyncRefreshPlan(
  plan: SyncRefreshPlan,
  blobs: FileBlobRecord[] = []
): Promise<void> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(['folder-records', 'folder-items', 'file-blobs'], 'readwrite')
  await Promise.all([
    ...plan.folders.map((folder) => tx.objectStore('folder-records').put(folder)),
    ...plan.items.map((item) => tx.objectStore('folder-items').put(item)),
    ...blobs.map((blob) => tx.objectStore('file-blobs').put(blob)),
    tx.done
  ])
  await Promise.all(plan.syncEntries.map((entry) => putSyncEntry(entry)))
  await Promise.all(
    plan.removedEntries.map(async (entry) => {
      await putSyncTombstone({
        providerConnectionId: entry.providerConnectionId,
        remoteItemId: entry.remoteItemId,
        itemId: entry.itemId,
        folderId: entry.folderId,
        blobId: entry.blobId,
        reason: 'remote-delete'
      })
      await putSyncEntry({
        providerConnectionId: entry.providerConnectionId,
        remoteItemId: entry.remoteItemId,
        parentRemoteItemId: entry.parentRemoteItemId,
        kind: entry.kind,
        name: entry.name,
        itemId: entry.itemId,
        folderId: entry.folderId,
        blobId: entry.blobId,
        mimeType: entry.mimeType,
        size: entry.size,
        etag: entry.etag,
        contentHash: entry.contentHash,
        status: 'deleted-pending-release'
      })
    })
  )
  await cleanupFileResources({
    folderIds: plan.removedFolderIds,
    itemIds: plan.removedItemIds
  })
  mergeSyncRefreshIntoStore(plan)
}

function mergeSyncRefreshIntoStore(plan: SyncRefreshPlan): void {
  const removedFolderIds = new Set(plan.removedFolderIds)
  const removedItemIds = new Set(plan.removedItemIds)
  const touchedParents = new Set<string>()
  for (const folder of plan.folders) {
    if (folder.parentId) touchedParents.add(folder.parentId)
  }
  for (const item of plan.items) touchedParents.add(item.parentId)

  useFileExplorerStore.setState((state) => {
    const folders = { ...state.folders }
    const items = { ...state.items }
    for (const id of removedFolderIds) delete folders[id]
    for (const id of removedItemIds) delete items[id]
    for (const folder of plan.folders) folders[folder.id] = folder
    for (const item of plan.items) items[item.id] = item

    const childFoldersByParent: typeof state._childFoldersByParent = {}
    for (const folder of Object.values(folders)) {
      if (folder.parentId === null) continue
      const list = childFoldersByParent[folder.parentId] ?? []
      list.push(folder)
      childFoldersByParent[folder.parentId] = list
    }
    for (const parentId of Object.keys(childFoldersByParent)) {
      childFoldersByParent[parentId] = sortByIndex(childFoldersByParent[parentId])
    }

    const loadedParents = new Set([...state.loadedParents, ...touchedParents])
    const itemsByParent: typeof state._itemsByParent = {}
    for (const parentId of loadedParents) {
      if (removedFolderIds.has(parentId)) continue
      itemsByParent[parentId] = sortByIndex(
        Object.values(items).filter((item) => item.parentId === parentId)
      )
    }

    return {
      folders,
      items,
      _foldersArray: Object.values(folders),
      _itemsArray: Object.values(items),
      _childFoldersByParent: childFoldersByParent,
      _itemsByParent: itemsByParent,
      loadedParents: new Set([...loadedParents].filter((id) => !removedFolderIds.has(id))),
      currentFolderId: removedFolderIds.has(state.currentFolderId)
        ? FILE_EXPLORER_ROOT_ID
        : state.currentFolderId
    }
  })
}
