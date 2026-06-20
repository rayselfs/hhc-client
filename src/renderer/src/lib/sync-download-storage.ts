import { toast } from '@heroui/react/toast'
import i18n from '@renderer/i18n'
import type { RemoteSyncItem, SyncDownloadRequest, SyncDownloadResult } from './sync-provider'
import { openFileExplorerDB } from './file-explorer-db'
import { isElectron } from './env'
import { MAX_FILE_SIZE_WEB } from './media-limits'
import { putSyncEntry } from './sync-db'

const STORAGE_USAGE_LIMIT_RATIO = 0.8
const STORAGE_LIMIT_ERROR = 'OneDrive sync storage has reached 80% usage'

class SyncStorageLimitError extends Error {
  constructor() {
    super(STORAGE_LIMIT_ERROR)
  }
}

async function ensureWebCapacity(size: number): Promise<void> {
  if (size > MAX_FILE_SIZE_WEB) {
    throw new Error('OneDrive file exceeds the Web 2GB limit')
  }
  if (!navigator.storage?.estimate) return
  const { quota, usage } = await navigator.storage.estimate()
  if (quota === undefined) return
  const currentUsage = usage ?? 0
  const usageLimit = quota * STORAGE_USAGE_LIMIT_RATIO
  const exceedsCurrentLimit = currentUsage >= usageLimit
  const exceedsProjectedLimit = currentUsage + size > usageLimit
  if (quota > 0 && (exceedsCurrentLimit || exceedsProjectedLimit)) {
    throw new SyncStorageLimitError()
  }
}

function isStorageLimitError(error: unknown): boolean {
  return (
    error instanceof SyncStorageLimitError ||
    (error instanceof Error && error.message === STORAGE_LIMIT_ERROR)
  )
}

async function markInsufficientStorage(
  request: SyncDownloadRequest,
  metadata: RemoteSyncItem
): Promise<void> {
  await putSyncEntry({
    providerConnectionId: request.providerConnectionId,
    remoteItemId: request.remoteItemId,
    parentRemoteItemId: metadata.parentRemoteItemId,
    kind: metadata.kind,
    name: metadata.name,
    mimeType: metadata.mimeType,
    size: metadata.size,
    etag: metadata.etag,
    contentHash: metadata.contentHash,
    status: 'insufficient-storage'
  })
  toast.danger(i18n.t('toast.syncStorageLimitReached'))
}

export async function saveWebOneDriveDownloadedContent(
  request: SyncDownloadRequest,
  response: Response,
  metadata: RemoteSyncItem
): Promise<SyncDownloadResult> {
  if (isElectron()) {
    throw new Error('Electron OneDrive downloads must use native streaming storage')
  }

  const contentLength = Number(response.headers.get('Content-Length') ?? metadata.size ?? 0)
  const size = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0
  try {
    await ensureWebCapacity(size)

    const blob = await response.blob()
    await ensureWebCapacity(blob.size)

    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: request.targetBlobId,
      blob,
      storage: 'indexed-db',
      size: blob.size,
      refCount: 1
    })
    await putSyncEntry({
      providerConnectionId: request.providerConnectionId,
      remoteItemId: request.remoteItemId,
      parentRemoteItemId: metadata.parentRemoteItemId,
      kind: metadata.kind,
      name: metadata.name,
      itemId: request.targetBlobId,
      blobId: request.targetBlobId,
      mimeType: metadata.mimeType,
      size: blob.size,
      etag: metadata.etag,
      contentHash: metadata.contentHash,
      status: 'available-offline'
    })

    return {
      blobId: request.targetBlobId,
      size: blob.size,
      mimeType: metadata.mimeType ?? blob.type
    }
  } catch (error) {
    if (isStorageLimitError(error)) await markInsufficientStorage(request, metadata)
    throw error
  }
}

export async function saveElectronOneDriveDownloadedContent(
  request: SyncDownloadRequest,
  clientId: string,
  metadata: RemoteSyncItem
): Promise<SyncDownloadResult> {
  if (!isElectron()) {
    throw new Error('Native OneDrive downloads are only available in Electron')
  }

  let downloaded: Awaited<ReturnType<typeof window.api.oneDrive.downloadFile>>
  try {
    const token = await window.api.oneDrive.getAccessToken({
      connectionId: request.providerConnectionId,
      clientId
    })
    downloaded = await window.api.oneDrive.downloadFile({
      remoteItemId: request.remoteItemId,
      targetFileId: request.targetBlobId,
      accessToken: token.accessToken,
      expectedSize: metadata.size,
      mimeType: metadata.mimeType
    })
  } catch (error) {
    if (isStorageLimitError(error)) await markInsufficientStorage(request, metadata)
    throw error
  }
  const db = await openFileExplorerDB()
  try {
    await db.put('file-blobs', {
      id: request.targetBlobId,
      storage: 'native-fs',
      size: downloaded.size,
      refCount: 1
    })
  } catch (error) {
    await window.api.nativeFs.delete(request.targetBlobId).catch(() => undefined)
    throw error
  }

  await putSyncEntry({
    providerConnectionId: request.providerConnectionId,
    remoteItemId: request.remoteItemId,
    parentRemoteItemId: metadata.parentRemoteItemId,
    kind: metadata.kind,
    name: metadata.name,
    itemId: request.targetBlobId,
    blobId: request.targetBlobId,
    mimeType: metadata.mimeType ?? downloaded.mimeType,
    size: downloaded.size,
    etag: metadata.etag,
    contentHash: metadata.contentHash,
    status: 'available-offline'
  })

  return {
    blobId: request.targetBlobId,
    size: downloaded.size,
    mimeType: metadata.mimeType ?? downloaded.mimeType ?? ''
  }
}
