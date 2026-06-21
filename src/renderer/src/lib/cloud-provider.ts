import type { ProviderConnectionRecord } from './sync-db'
import {
  getConnectedOneDriveAccount,
  importOneDriveFolder,
  listOneDriveFolders,
  refreshOneDriveFolder
} from './onedrive-connect'

export type CloudProviderId = 'onedrive'

export interface CloudRemoteFolder {
  remoteItemId: string
  name: string
  parentRemoteItemId: string | null
}

export interface CloudImportResult {
  connectionId: string
  displayName: string
  folderCount: number
  itemCount: number
  downloadedCount: number
  disabledCount: number
}

export interface CloudRefreshSummary {
  connectionId: string
  rootFolderId: string
  updatedItemCount: number
  removedItemCount: number
  removedFolderCount: number
  downloadedCount: number
  failedFileCount: number
  disabledFileCount: number
  changedCount?: number
  pendingFileCount?: number
  retryableFileCount?: number
  nextRetryAt?: number
  usedCursor?: boolean
  fullScanFallback?: boolean
}

export interface CloudProviderAdapter {
  id: CloudProviderId
  getConnectedAccount(): Promise<ProviderConnectionRecord | null>
  listFolders(parentRemoteFolderId?: string): Promise<CloudRemoteFolder[]>
  importFolder(folder: CloudRemoteFolder): Promise<CloudImportResult>
  refreshFolder(
    rootFolderId: string,
    options?: { forceRetry?: boolean }
  ): Promise<CloudRefreshSummary>
}

const ONEDRIVE_ADAPTER: CloudProviderAdapter = {
  id: 'onedrive',
  getConnectedAccount: getConnectedOneDriveAccount,
  listFolders: listOneDriveFolders,
  importFolder: importOneDriveFolder,
  refreshFolder: refreshOneDriveFolder
}

export function getCloudProviderAdapter(providerId: CloudProviderId): CloudProviderAdapter {
  if (providerId === 'onedrive') return ONEDRIVE_ADAPTER
  throw new Error(`Unsupported cloud provider: ${providerId}`)
}
