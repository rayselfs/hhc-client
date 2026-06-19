import { toast } from '@heroui/react/toast'
import type { FileItemRecord, FolderRecord, SyncOfflinePolicy } from '@shared/types/folder'
import { FILE_EXPLORER_ROOT_ID, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { getEffectiveOneDriveClientId, useSettingsStore } from '@renderer/stores/settings'
import { isElectron } from './env'
import {
  createOneDriveAuthRequest,
  createOneDriveTokenExchangeBody,
  parseOneDriveAuthCallback
} from './onedrive-auth'
import { OneDriveReadonlyProvider } from './onedrive-provider'
import { openFileExplorerDB } from './file-explorer-db'
import { resolveUniqueName } from './file-naming'
import {
  listProviderConnectionsByType,
  deleteProviderConnection,
  putSyncCursor,
  putSyncEntry,
  type SyncEntryRecord
} from './sync-db'
import { saveElectronOneDriveDownloadedContent } from './sync-download-storage'
import { getMediaSupport, resolveMediaCapability, type MediaPlatform } from './media-capabilities'
import type { RemoteSyncItem } from './sync-provider'
import i18n from '@renderer/i18n'

const ONEDRIVE_NATIVE_REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
  scope?: string
  token_type?: 'Bearer'
}

interface OneDriveImportPlan {
  folders: FolderRecord[]
  items: FileItemRecord[]
  syncEntries: Array<Omit<SyncEntryRecord, 'id' | 'createdAt' | 'updatedAt'>>
  downloadableItems: Array<{ itemId: string; remoteItemId: string }>
  disabledCount: number
}

export interface OneDriveConnectResult {
  connectionId: string
  displayName: string
  folderCount: number
  itemCount: number
  downloadedCount: number
  disabledCount: number
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_')
}

function createRootFolderId(connectionId: string): string {
  return `onedrive-folder-${safeIdPart(connectionId)}`
}

function createSyncedFolderId(connectionId: string, remoteItemId: string): string {
  return `onedrive-folder-${safeIdPart(connectionId)}-${safeIdPart(remoteItemId)}`
}

function createSyncedItemId(connectionId: string, remoteItemId: string): string {
  return `onedrive-item-${safeIdPart(connectionId)}-${safeIdPart(remoteItemId)}`
}

function classifyRemoteFile(
  item: RemoteSyncItem,
  platform: MediaPlatform
): {
  mimeType: string
  disabled: boolean
} {
  const capability = resolveMediaCapability({ mimeType: item.mimeType, fileName: item.name })
  if (!capability) return { mimeType: item.mimeType ?? 'application/octet-stream', disabled: true }
  const support = getMediaSupport(capability, platform)
  return { mimeType: capability.canonicalMimeType, disabled: support === 'unsupported' }
}

function sortByIndex<T extends { sortIndex: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.sortIndex - b.sortIndex)
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

function buildOneDriveImportPlan(input: {
  connectionId: string
  displayName: string
  offlinePolicy: SyncOfflinePolicy
  remoteItems: RemoteSyncItem[]
  existingRootFolderNames: string[]
  platform: MediaPlatform
}): OneDriveImportPlan {
  const now = Date.now()
  const rootFolderId = createRootFolderId(input.connectionId)
  const rootFolder: FolderRecord = {
    id: rootFolderId,
    name: resolveUniqueName(input.displayName, input.existingRootFolderNames),
    parentId: FILE_EXPLORER_ROOT_ID,
    sortIndex: input.existingRootFolderNames.length,
    createdAt: now,
    expiresAt: null,
    syncLink: {
      providerConnectionId: input.connectionId,
      remoteFolderId: 'root',
      providerType: 'onedrive',
      offlinePolicy: input.offlinePolicy
    }
  }

  const folders: FolderRecord[] = [rootFolder]
  const items: FileItemRecord[] = []
  const syncEntries: OneDriveImportPlan['syncEntries'] = [
    {
      providerConnectionId: input.connectionId,
      remoteItemId: 'root',
      parentRemoteItemId: null,
      kind: 'folder',
      name: input.displayName,
      folderId: rootFolderId,
      status: 'remote-only'
    }
  ]
  const downloadableItems: OneDriveImportPlan['downloadableItems'] = []
  const remoteFolderToLocalId = new Map<string | null, string>([[null, rootFolderId]])
  const folderSortCounts = new Map<string, number>([
    [FILE_EXPLORER_ROOT_ID, input.existingRootFolderNames.length + 1]
  ])
  const itemSortCounts = new Map<string, number>()
  let disabledCount = 0

  for (const remoteItem of input.remoteItems) {
    if (remoteItem.kind !== 'folder' || remoteItem.deleted) continue
    const parentId = remoteFolderToLocalId.get(remoteItem.parentRemoteItemId) ?? rootFolderId
    const folderId = createSyncedFolderId(input.connectionId, remoteItem.remoteItemId)
    const sortIndex = folderSortCounts.get(parentId) ?? 0
    folderSortCounts.set(parentId, sortIndex + 1)
    folders.push({
      id: folderId,
      name: remoteItem.name,
      parentId,
      sortIndex,
      createdAt: now,
      expiresAt: null,
      syncLink: {
        providerConnectionId: input.connectionId,
        remoteFolderId: remoteItem.remoteItemId,
        providerType: 'onedrive',
        offlinePolicy: input.offlinePolicy
      }
    })
    remoteFolderToLocalId.set(remoteItem.remoteItemId, folderId)
    syncEntries.push({
      providerConnectionId: input.connectionId,
      remoteItemId: remoteItem.remoteItemId,
      parentRemoteItemId: remoteItem.parentRemoteItemId,
      kind: 'folder',
      name: remoteItem.name,
      folderId,
      status: 'remote-only'
    })
  }

  for (const remoteItem of input.remoteItems) {
    if (remoteItem.kind !== 'file' || remoteItem.deleted) continue
    const parentId = remoteFolderToLocalId.get(remoteItem.parentRemoteItemId) ?? rootFolderId
    const itemId = createSyncedItemId(input.connectionId, remoteItem.remoteItemId)
    const sortIndex = itemSortCounts.get(parentId) ?? 0
    itemSortCounts.set(parentId, sortIndex + 1)
    const policy = classifyRemoteFile(remoteItem, input.platform)
    items.push({
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
    })
    if (policy.disabled) {
      disabledCount++
      continue
    }
    downloadableItems.push({ itemId, remoteItemId: remoteItem.remoteItemId })
    syncEntries.push({
      providerConnectionId: input.connectionId,
      remoteItemId: remoteItem.remoteItemId,
      parentRemoteItemId: remoteItem.parentRemoteItemId,
      kind: 'file',
      name: remoteItem.name,
      itemId,
      blobId: itemId,
      mimeType: policy.mimeType,
      size: remoteItem.size,
      etag: remoteItem.etag,
      contentHash: remoteItem.contentHash,
      status: input.offlinePolicy === 'always-offline' ? 'queued' : 'remote-only'
    })
  }

  return { folders, items, syncEntries, downloadableItems, disabledCount }
}

async function exchangeToken(input: {
  clientId: string
  redirectUri: string
  code: string
  codeVerifier: string
}): Promise<TokenResponse> {
  const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createOneDriveTokenExchangeBody(input)
  })
  if (!response.ok) throw new Error(`OneDrive token exchange failed: ${response.status}`)
  const data = (await response.json()) as Partial<TokenResponse>
  if (!data.access_token || !data.refresh_token) {
    throw new Error('Invalid OneDrive token response')
  }
  return data as TokenResponse
}

async function saveImportedRecords(
  folders: FolderRecord[],
  items: FileItemRecord[]
): Promise<void> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(['folder-records', 'folder-items'], 'readwrite')
  await Promise.all([
    ...folders.map((folder) => tx.objectStore('folder-records').put(folder)),
    ...items.map((item) => tx.objectStore('folder-items').put(item)),
    tx.done
  ])
}

export async function connectOneDriveAccount(): Promise<OneDriveConnectResult | null> {
  if (!isElectron() || !window.api?.oneDrive) {
    throw new Error('OneDrive connection is currently available in the desktop app only')
  }
  const existing = await listProviderConnectionsByType('onedrive')
  if (existing.length > 0) {
    throw new Error('Only one OneDrive account can be connected')
  }

  const oneDriveSettings = useSettingsStore.getState().oneDrive
  const clientId = getEffectiveOneDriveClientId(oneDriveSettings)
  const request = await createOneDriveAuthRequest({
    clientId,
    redirectUri: ONEDRIVE_NATIVE_REDIRECT_URI,
    prompt: 'select_account'
  })
  window.open(request.authorizationUrl, '_blank', 'noopener,noreferrer')
  const callbackUrl = window.prompt(i18n.t('fileExplorer.syncSources.oneDriveCallbackPrompt'))
  if (!callbackUrl) return null

  const callback = parseOneDriveAuthCallback(callbackUrl, request.state)
  const token = await exchangeToken({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    code: callback.code,
    codeVerifier: request.codeVerifier
  })
  const provider = new OneDriveReadonlyProvider({
    getAccessToken: async () => token.access_token,
    saveDownloadedContent: (downloadRequest, _response, metadata) =>
      saveElectronOneDriveDownloadedContent(downloadRequest, request.clientId, metadata)
  })

  const connection = await provider.connect()
  try {
    await window.api.oneDrive.saveCredentials({
      connectionId: connection.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt:
        typeof token.expires_in === 'number' && Number.isFinite(token.expires_in)
          ? Date.now() + token.expires_in * 1000
          : undefined,
      scope: token.scope,
      tokenType: token.token_type
    })

    const firstPage = await provider.initialScan(connection.id, 'root')
    const remoteItems = [...firstPage.items]
    let nextCursor = firstPage.nextCursor
    let hasMore = firstPage.hasMore
    while (hasMore && nextCursor) {
      const nextPage = await provider.incrementalChanges({
        providerConnectionId: connection.id,
        remoteFolderId: 'root',
        cursor: nextCursor
      })
      remoteItems.push(...nextPage.items)
      nextCursor = nextPage.nextCursor
      hasMore = nextPage.hasMore
    }

    const store = useFileExplorerStore.getState()
    await store.initialize()
    const plan = buildOneDriveImportPlan({
      connectionId: connection.id,
      displayName: connection.displayName,
      offlinePolicy: oneDriveSettings.defaultOfflinePolicy,
      remoteItems,
      existingRootFolderNames: store
        .getChildFolders(FILE_EXPLORER_ROOT_ID)
        .map((folder) => folder.name),
      platform: 'electron'
    })
    await saveImportedRecords(plan.folders, plan.items)
    await Promise.all(plan.syncEntries.map((entry) => putSyncEntry(entry)))
    if (nextCursor) {
      await putSyncCursor({
        providerConnectionId: connection.id,
        remoteFolderId: 'root',
        cursor: nextCursor,
        updatedAt: Date.now()
      })
    }

    let downloadedCount = 0
    if (oneDriveSettings.defaultOfflinePolicy === 'always-offline') {
      const remoteById = new Map(remoteItems.map((item) => [item.remoteItemId, item]))
      for (const item of plan.downloadableItems) {
        try {
          await provider.downloadContent(
            {
              providerConnectionId: connection.id,
              remoteItemId: item.remoteItemId,
              targetBlobId: item.itemId,
              offlinePolicy: 'always-offline'
            },
            new AbortController().signal
          )
          downloadedCount++
        } catch (error) {
          console.warn('[onedrive] Failed to download file for offline use', {
            connectionId: connection.id,
            remoteItemId: item.remoteItemId,
            error
          })
          const remoteItem = remoteById.get(item.remoteItemId)
          if (remoteItem) {
            await putSyncEntry({
              providerConnectionId: connection.id,
              remoteItemId: item.remoteItemId,
              parentRemoteItemId: remoteItem.parentRemoteItemId,
              kind: 'file',
              name: remoteItem.name,
              itemId: item.itemId,
              blobId: item.itemId,
              mimeType: remoteItem.mimeType,
              size: remoteItem.size,
              etag: remoteItem.etag,
              contentHash: remoteItem.contentHash,
              status: 'failed'
            })
          }
        }
      }
    }

    mergeImportedRecordsIntoStore(plan.folders, plan.items)
    if (plan.disabledCount > 0) {
      toast.warning(
        i18n.t('fileExplorer.syncSources.unsupportedFiles', { count: plan.disabledCount })
      )
    }

    return {
      connectionId: connection.id,
      displayName: connection.displayName,
      folderCount: plan.folders.length,
      itemCount: plan.items.length,
      downloadedCount,
      disabledCount: plan.disabledCount
    }
  } catch (error) {
    await window.api.oneDrive.deleteCredentials(connection.id).catch(() => undefined)
    await deleteProviderConnection(connection.id).catch(() => undefined)
    throw error
  }
}
