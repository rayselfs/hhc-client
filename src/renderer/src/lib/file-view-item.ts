import type { GridViewItem } from '@renderer/components/Control/FileExplorer/views'
import { FILE_EXPLORER_ROOT_ID } from '@renderer/stores/file-explorer'
import type { SyncEntryStatus } from './sync-db'
import type { SyncFolderHealth } from './sync-folder-health'
import type { FolderRecord } from '@shared/types/folder'

interface SyncItemViewState {
  status: SyncEntryStatus
  downloadedBytes?: number
  downloadTotalBytes?: number
}

export function buildFolderViewItem(
  folder: Pick<FolderRecord, 'id' | 'name' | 'parentId' | 'createdAt' | 'isFavorited' | 'syncLink'>,
  options: {
    health?: SyncFolderHealth
    healthTooltip?: string
    syncState?: SyncItemViewState
  } = {}
): GridViewItem {
  return {
    id: folder.id,
    name: folder.name,
    isFolder: true,
    createdAt: folder.createdAt,
    isFavorited: folder.isFavorited,
    isSelected: false,
    syncStatus: options.syncState?.status,
    downloadedBytes: options.syncState?.downloadedBytes,
    downloadTotalBytes: options.syncState?.downloadTotalBytes,
    syncProviderType:
      folder.parentId === FILE_EXPLORER_ROOT_ID ? folder.syncLink?.providerType : undefined,
    syncFolderHealth: options.health?.status,
    syncFolderHealthTooltip: options.healthTooltip
  }
}
