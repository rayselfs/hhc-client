import type { RemoteSyncItem, SyncDownloadRequest, SyncDownloadResult } from './sync-provider'
import { openFileExplorerDB } from './file-explorer-db'
import { isElectron } from './env'
import { MAX_FILE_SIZE_WEB } from './media-limits'
import { putSyncEntry } from './sync-db'

async function ensureWebCapacity(size: number): Promise<void> {
  if (size > MAX_FILE_SIZE_WEB) {
    throw new Error('OneDrive file exceeds the Web 2GB limit')
  }
  if (!navigator.storage?.estimate) return
  const { quota, usage } = await navigator.storage.estimate()
  if (quota === undefined) return
  const available = Math.max(0, quota - (usage ?? 0))
  if (size > available) throw new Error('Insufficient browser storage for OneDrive file')
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
}

export async function saveElectronOneDriveDownloadedContent(
  request: SyncDownloadRequest,
  accessToken: string,
  metadata: RemoteSyncItem
): Promise<SyncDownloadResult> {
  if (!isElectron()) {
    throw new Error('Native OneDrive downloads are only available in Electron')
  }

  const downloaded = await window.api.oneDrive.downloadFile({
    remoteItemId: request.remoteItemId,
    targetFileId: request.targetBlobId,
    accessToken,
    expectedSize: metadata.size,
    mimeType: metadata.mimeType
  })
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
