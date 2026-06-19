import { toast } from '@heroui/react/toast'
import type { LocalSyncConnectionInfo, LocalSyncRemoteItem } from '@shared/ipc-channels'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import { FILE_EXPLORER_ROOT_ID, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isWeb } from '@renderer/lib/env'
import { openFileExplorerDB, type FileBlobRecord } from '@renderer/lib/file-explorer-db'
import { resolveUniqueName } from '@renderer/lib/file-naming'
import {
  getMediaSupport,
  resolveMediaCapability,
  type MediaKind,
  type MediaPlatform,
  type MediaSupportMode
} from '@renderer/lib/media-capabilities'
import { ensureSourceMediaMetadata } from '@renderer/lib/media-metadata'
import { enqueueVideoPosterJob } from '@renderer/lib/video-poster-jobs'
import { putProviderConnection, putSyncEntry, type SyncEntryRecord } from '@renderer/lib/sync-db'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { saveThumbnail } from '@renderer/lib/thumbnail-db'
import i18n from '@renderer/i18n'

interface SyncFilePolicy {
  kind: MediaKind | 'unsupported'
  mimeType: string
  support: MediaSupportMode
  disabled: boolean
}

interface LocalSyncImportPlanInput {
  connection: LocalSyncConnectionInfo
  remoteItems: LocalSyncRemoteItem[]
  platform: MediaPlatform
  existingRootFolderNames: string[]
}

interface LocalSyncFileImport {
  itemId: string
  remoteItemId: string
  mimeType: string
}

interface LocalSyncImportPlan {
  rootFolder: FolderRecord
  folders: FolderRecord[]
  items: FileItemRecord[]
  fileImports: LocalSyncFileImport[]
  syncEntries: Array<Omit<SyncEntryRecord, 'id' | 'createdAt' | 'updatedAt'>>
  disabledCount: number
}

export interface LocalSyncImportSummary {
  connection: LocalSyncConnectionInfo
  rootFolderId: string
  folderCount: number
  itemCount: number
  importedFileCount: number
  disabledFileCount: number
}

function sortByIndex<T extends { sortIndex: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.sortIndex - b.sortIndex)
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_')
}

function createRootFolderId(connectionId: string): string {
  return `local-sync-folder-${safeIdPart(connectionId)}`
}

function createSyncedFolderId(connectionId: string, remoteItemId: string): string {
  return `local-sync-folder-${safeIdPart(connectionId)}-${safeIdPart(remoteItemId)}`
}

function createSyncedItemId(connectionId: string, remoteItemId: string): string {
  return `local-sync-item-${safeIdPart(connectionId)}-${safeIdPart(remoteItemId)}`
}

export function classifySyncRemoteFile(
  item: Pick<LocalSyncRemoteItem, 'name' | 'mimeType'>,
  platform: MediaPlatform
): SyncFilePolicy {
  const capability = resolveMediaCapability({ mimeType: item.mimeType, fileName: item.name })
  if (!capability) {
    return {
      kind: 'unsupported',
      mimeType: item.mimeType ?? 'application/octet-stream',
      support: 'unsupported',
      disabled: true
    }
  }

  const support = getMediaSupport(capability, platform)
  return {
    kind: support === 'unsupported' ? 'unsupported' : capability.kind,
    mimeType: capability.canonicalMimeType,
    support,
    disabled: support === 'unsupported'
  }
}

export function buildLocalSyncImportPlan(input: LocalSyncImportPlanInput): LocalSyncImportPlan {
  const now = Date.now()
  const rootFolderId = createRootFolderId(input.connection.id)
  const rootFolder: FolderRecord = {
    id: rootFolderId,
    name: resolveUniqueName(input.connection.rootName, input.existingRootFolderNames),
    parentId: FILE_EXPLORER_ROOT_ID,
    sortIndex: input.existingRootFolderNames.length,
    createdAt: now,
    expiresAt: null,
    syncLink: {
      providerConnectionId: input.connection.id,
      remoteFolderId: '.',
      providerType: 'local-fs',
      offlinePolicy: 'always-offline'
    }
  }

  const folders: FolderRecord[] = [rootFolder]
  const items: FileItemRecord[] = []
  const fileImports: LocalSyncFileImport[] = []
  const syncEntries: LocalSyncImportPlan['syncEntries'] = [
    {
      providerConnectionId: input.connection.id,
      remoteItemId: '.',
      parentRemoteItemId: null,
      kind: 'folder',
      name: input.connection.rootName,
      folderId: rootFolder.id,
      status: 'available-offline'
    }
  ]
  const remoteFolderToLocalId = new Map<string | null, string>([[null, rootFolderId]])
  const folderSortCounts = new Map<string, number>([
    [FILE_EXPLORER_ROOT_ID, input.existingRootFolderNames.length + 1]
  ])
  const itemSortCounts = new Map<string, number>()
  let disabledCount = 0

  for (const remoteItem of input.remoteItems) {
    if (remoteItem.kind !== 'folder') continue
    const parentId = remoteFolderToLocalId.get(remoteItem.parentRemoteItemId) ?? rootFolderId
    const localFolderId = createSyncedFolderId(input.connection.id, remoteItem.remoteItemId)
    const sortIndex = folderSortCounts.get(parentId) ?? 0
    folderSortCounts.set(parentId, sortIndex + 1)
    const folder: FolderRecord = {
      id: localFolderId,
      name: remoteItem.name,
      parentId,
      sortIndex,
      createdAt: now,
      expiresAt: null,
      syncLink: {
        providerConnectionId: input.connection.id,
        remoteFolderId: remoteItem.remoteItemId,
        providerType: 'local-fs',
        offlinePolicy: 'always-offline'
      }
    }
    folders.push(folder)
    remoteFolderToLocalId.set(remoteItem.remoteItemId, localFolderId)
    syncEntries.push({
      providerConnectionId: input.connection.id,
      remoteItemId: remoteItem.remoteItemId,
      parentRemoteItemId: remoteItem.parentRemoteItemId,
      kind: 'folder',
      name: remoteItem.name,
      folderId: localFolderId,
      status: 'available-offline'
    })
  }

  for (const remoteItem of input.remoteItems) {
    if (remoteItem.kind !== 'file') continue
    const parentId = remoteFolderToLocalId.get(remoteItem.parentRemoteItemId) ?? rootFolderId
    const policy = classifySyncRemoteFile(remoteItem, input.platform)
    const itemId = createSyncedItemId(input.connection.id, remoteItem.remoteItemId)
    const sortIndex = itemSortCounts.get(parentId) ?? 0
    itemSortCounts.set(parentId, sortIndex + 1)
    const item: FileItemRecord = {
      id: itemId,
      parentId,
      type: 'file',
      sortIndex,
      createdAt: now,
      expiresAt: null,
      name: remoteItem.name,
      url: policy.disabled ? `unsupported:${itemId}` : `blob:${itemId}`,
      size: remoteItem.size ?? 0,
      mimeType: policy.mimeType
    }
    items.push(item)
    if (policy.disabled) {
      disabledCount++
      continue
    }
    fileImports.push({ itemId, remoteItemId: remoteItem.remoteItemId, mimeType: policy.mimeType })
    syncEntries.push({
      providerConnectionId: input.connection.id,
      remoteItemId: remoteItem.remoteItemId,
      parentRemoteItemId: remoteItem.parentRemoteItemId,
      kind: 'file',
      name: remoteItem.name,
      itemId,
      blobId: itemId,
      mimeType: policy.mimeType,
      size: remoteItem.size,
      etag: remoteItem.etag,
      status: 'available-offline'
    })
  }

  return { rootFolder, folders, items, fileImports, syncEntries, disabledCount }
}

function mergeImportedRecordsIntoStore(folders: FolderRecord[], items: FileItemRecord[]): void {
  const importedParentIds = new Set<string>(folders.map((folder) => folder.id))
  importedParentIds.add(FILE_EXPLORER_ROOT_ID)
  for (const item of items) importedParentIds.add(item.parentId)

  useFileExplorerStore.setState((state) => {
    const nextFolders = { ...state.folders }
    const nextItems = { ...state.items }
    for (const folder of folders) nextFolders[folder.id] = folder
    for (const item of items) nextItems[item.id] = item

    const childFoldersByParent: typeof state._childFoldersByParent = {}
    for (const folder of Object.values(nextFolders)) {
      if (folder.parentId === null) continue
      const list = childFoldersByParent[folder.parentId] ?? []
      list.push(folder)
      childFoldersByParent[folder.parentId] = list
    }
    for (const parentId of Object.keys(childFoldersByParent)) {
      childFoldersByParent[parentId] = sortByIndex(childFoldersByParent[parentId])
    }

    const loadedParents = new Set([...state.loadedParents, ...importedParentIds])
    const itemsByParent: typeof state._itemsByParent = {}
    for (const parentId of loadedParents) {
      itemsByParent[parentId] = sortByIndex(
        Object.values(nextItems).filter((item) => item.parentId === parentId)
      )
    }

    return {
      folders: nextFolders,
      items: nextItems,
      _foldersArray: Object.values(nextFolders),
      _itemsArray: Object.values(nextItems),
      _childFoldersByParent: childFoldersByParent,
      _itemsByParent: itemsByParent,
      loadedParents
    }
  })
}

async function saveImportedRecords(
  plan: LocalSyncImportPlan,
  blobs: FileBlobRecord[]
): Promise<void> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(['folder-records', 'folder-items', 'file-blobs'], 'readwrite')
  await Promise.all([
    ...plan.folders.map((folder) => tx.objectStore('folder-records').put(folder)),
    ...plan.items.map((item) => tx.objectStore('folder-items').put(item)),
    ...blobs.map((blob) => tx.objectStore('file-blobs').put(blob)),
    tx.done
  ])
}

async function refreshImportedMediaAssets(items: FileItemRecord[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      if (!item.url.startsWith('blob:')) return
      const capability = resolveMediaCapability({ mimeType: item.mimeType, fileName: item.name })
      if (!capability) return
      void ensureSourceMediaMetadata(item.id, item.mimeType).catch((error) => {
        console.warn('[local-sync] Failed to store synced media metadata', {
          itemId: item.id,
          error
        })
      })
      if (capability.kind === 'video' && !isWeb()) {
        await enqueueVideoPosterJob({ sourceBlobId: item.id, itemId: item.id })
        return
      }
      if (capability.thumbnail === 'none') return
      const url = window.api.nativeFs.getUrl(item.id, item.mimeType)
      const response = await fetch(url)
      if (!response.ok) return
      const file = new File([await response.blob()], item.name, { type: item.mimeType })
      const thumbnail = await generateThumbnail(file, item.mimeType)
      if (!thumbnail) return
      await saveThumbnail(item.id, thumbnail)
      window.dispatchEvent(
        new CustomEvent('hhc:thumbnail-ready', { detail: { itemId: item.id, dataUrl: thumbnail } })
      )
    })
  )
}

export async function importLocalSyncConnection(
  connection: LocalSyncConnectionInfo,
  remoteItems: LocalSyncRemoteItem[],
  platform: MediaPlatform
): Promise<LocalSyncImportSummary> {
  const store = useFileExplorerStore.getState()
  await store.initialize()
  const existingRootFolderNames = store
    .getChildFolders(FILE_EXPLORER_ROOT_ID)
    .map((folder) => folder.name)
  const plan = buildLocalSyncImportPlan({
    connection,
    remoteItems,
    platform,
    existingRootFolderNames
  })
  const blobs: FileBlobRecord[] = []
  const copiedIds: string[] = []
  const failedImportIds = new Set<string>()

  for (const fileImport of plan.fileImports) {
    try {
      const result = await window.api.localSync.importFile({
        connectionId: connection.id,
        remoteItemId: fileImport.remoteItemId,
        targetFileId: fileImport.itemId
      })
      copiedIds.push(fileImport.itemId)
      blobs.push({
        id: fileImport.itemId,
        storage: 'native-fs',
        size: result.size,
        refCount: 1
      })
    } catch (error) {
      failedImportIds.add(fileImport.itemId)
      console.warn('[local-sync] Failed to import synced file', {
        connectionId: connection.id,
        remoteItemId: fileImport.remoteItemId,
        error
      })
    }
  }

  const savedPlan: LocalSyncImportPlan = {
    ...plan,
    items: plan.items.filter((item) => !failedImportIds.has(item.id)),
    fileImports: plan.fileImports.filter((item) => !failedImportIds.has(item.itemId)),
    syncEntries: plan.syncEntries.filter(
      (entry) => !entry.itemId || !failedImportIds.has(entry.itemId)
    )
  }

  try {
    await saveImportedRecords(savedPlan, blobs)
  } catch (error) {
    await Promise.all(copiedIds.map((id) => window.api.nativeFs.delete(id).catch(() => undefined)))
    throw error
  }

  await putProviderConnection({
    id: connection.id,
    providerType: 'local-fs',
    displayName: connection.displayName
  })
  await Promise.all(savedPlan.syncEntries.map((entry) => putSyncEntry(entry)))
  mergeImportedRecordsIntoStore(savedPlan.folders, savedPlan.items)
  void refreshImportedMediaAssets(savedPlan.items)

  return {
    connection,
    rootFolderId: savedPlan.rootFolder.id,
    folderCount: savedPlan.folders.length,
    itemCount: savedPlan.items.length,
    importedFileCount: savedPlan.fileImports.length,
    disabledFileCount: savedPlan.disabledCount
  }
}

export async function connectLocalSyncFolder(): Promise<LocalSyncImportSummary | null> {
  if (isWeb()) throw new Error('Local sync folders are only available in Electron')
  const connection = await window.api.localSync.selectFolder()
  if (!connection) return null
  const remoteItems = await window.api.localSync.scanFolder(connection.id)
  const summary = await importLocalSyncConnection(connection, remoteItems, 'electron')
  if (summary.disabledFileCount > 0) {
    toast.warning(
      i18n.t('fileExplorer.syncSources.unsupportedFiles', {
        count: summary.disabledFileCount
      })
    )
  }
  return summary
}
