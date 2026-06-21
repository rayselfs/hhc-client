import type { ProviderConnectionRecord } from './sync-db'
import {
  getConnectedOneDriveAccount,
  importOneDriveFolder,
  listOneDriveFolders,
  refreshOneDriveFolder,
  type OneDriveConnectResult,
  type OneDriveRefreshSummary,
  type OneDriveRemoteFolder
} from './onedrive-connect'

export type CloudProviderId = 'onedrive'

export interface CloudProviderAdapter {
  id: CloudProviderId
  getConnectedAccount(): Promise<ProviderConnectionRecord | null>
  listFolders(parentRemoteFolderId?: string): Promise<OneDriveRemoteFolder[]>
  importFolder(folder: OneDriveRemoteFolder): Promise<OneDriveConnectResult>
  refreshFolder(rootFolderId: string): Promise<OneDriveRefreshSummary>
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
