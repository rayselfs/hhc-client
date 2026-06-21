import React from 'react'
import { Folder, FolderSync, Star } from 'lucide-react'
import { Skeleton } from '@heroui/react/skeleton'
import { useTranslation } from 'react-i18next'
import { getFileIcon } from './getFileIcon'
import { canHaveThumbnail } from '@renderer/hooks/useThumbnails'
import { InlineRenameInput } from '../InlineRenameInput'
import { splitFileName } from '@renderer/lib/file-naming'
import { OneDriveIcon } from '@renderer/components/icons/OneDriveIcon'
import type { SyncEntryStatus } from '@renderer/lib/sync-db'
import type { SyncProviderType } from '@shared/types/folder'
import { SyncStatusIcon } from './SyncStatusBadge'

export interface GridViewItem {
  id: string
  name: string
  isFolder: boolean
  mimeType?: string
  size?: number
  createdAt?: number
  thumbnailUrl?: string | null
  isSelected: boolean
  isFavorited?: boolean
  syncStatus?: SyncEntryStatus
  syncProviderType?: SyncProviderType
  isUnsupportedMedia?: boolean
}

function renderGridIcon(item: GridViewItem, iconSize: number): React.ReactNode {
  if (item.isFolder) {
    return <Folder size={iconSize} className="text-accent" fill="currentColor" />
  }

  if (item.isUnsupportedMedia) {
    return <div className="text-danger">{getFileIcon(item.mimeType, item.isFolder, iconSize)}</div>
  }

  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt={item.name}
        className="object-cover rounded"
        style={{ width: iconSize, height: iconSize }}
      />
    )
  }

  if (item.thumbnailUrl === undefined && canHaveThumbnail(item.mimeType)) {
    return <Skeleton className="rounded" style={{ width: iconSize, height: iconSize }} />
  }

  return (
    <div className="text-default-500">{getFileIcon(item.mimeType, item.isFolder, iconSize)}</div>
  )
}

function renderSyncProviderIcon(providerType?: SyncProviderType): React.ReactNode {
  if (!providerType) return null
  const icon =
    providerType === 'onedrive' ? (
      <OneDriveIcon className="size-[18px]" />
    ) : (
      <FolderSync size={18} />
    )
  return (
    <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-sm">
      <span className="rounded-full bg-primary/90 p-1">{icon}</span>
    </span>
  )
}

export interface GridViewProps {
  items: GridViewItem[]
  viewMode: 'large-icon' | 'medium-icon' | 'small-icon'
  onItemClick: (id: string, event: React.MouseEvent) => void
  onItemDoubleClick: (id: string, event: React.MouseEvent) => void
  onItemContextMenu: (id: string, event: React.MouseEvent) => void
  onItemFavoriteToggle?: (id: string) => void
  renamingItemId?: string | null
  onRenameSubmit?: (id: string, baseName: string) => void
  onRenameCancel?: () => void
  renderItemWrapper?: (item: GridViewItem, children: React.ReactNode) => React.ReactNode
}

export const GridView = React.memo(function GridView({
  items,
  viewMode,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  onItemFavoriteToggle,
  renamingItemId,
  onRenameSubmit,
  onRenameCancel,
  renderItemWrapper
}: GridViewProps): React.JSX.Element {
  const { t } = useTranslation()

  let gridColsClass = ''
  let iconSize = 32
  let nameClass = ''

  switch (viewMode) {
    case 'large-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,192px)]'
      iconSize = 96
      nameClass = 'line-clamp-2 text-base mt-2'
      break
    case 'medium-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,128px)]'
      iconSize = 64
      nameClass = 'line-clamp-2 text-sm mt-2'
      break
    case 'small-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,88px)]'
      iconSize = 40
      nameClass = 'line-clamp-2 text-xs mt-1'
      break
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-4">
        <h3 className="text-lg font-medium text-foreground">
          {t('fileExplorer.empty.title', 'No files yet')}
        </h3>
        <p className="text-sm text-default-400 mt-1">
          {t('fileExplorer.empty.description', 'Upload files to get started')}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full p-4">
      <div className={`grid gap-4 ${gridColsClass}`}>
        {items.map((item) => {
          const isRenaming = renamingItemId === item.id
          const splitName = splitFileName(item.name)
          const content = (
            <div
              data-file-item
              data-item-id={item.id}
              className={`group relative flex flex-col items-center justify-start rounded-lg p-2 cursor-default transition-colors hover:bg-content2/60 ${
                item.isSelected ? 'bg-surface' : ''
              }`}
              onClick={(e) => onItemClick(item.id, e)}
              onDoubleClick={(e) => onItemDoubleClick(item.id, e)}
              onContextMenu={(e) => onItemContextMenu(item.id, e)}
            >
              {item.isFolder && onItemFavoriteToggle && (
                <button
                  className={`absolute top-1 right-1 rounded p-0.5 transition-opacity ${
                    item.isFavorited
                      ? 'opacity-100 text-yellow-400'
                      : 'opacity-0 group-hover:opacity-100 text-default-400 hover:text-yellow-400'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onItemFavoriteToggle(item.id)
                  }}
                  aria-label={item.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    size={16}
                    className={item.isFavorited ? 'fill-yellow-400 drop-shadow-sm' : ''}
                  />
                </button>
              )}
              <div className="relative flex items-center justify-center">
                {renderGridIcon(item, iconSize)}
                {item.isFolder ? renderSyncProviderIcon(item.syncProviderType) : null}
                {!item.isFolder && item.syncStatus ? (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-background/90">
                    <SyncStatusIcon status={item.syncStatus} />
                  </span>
                ) : null}
              </div>
              {isRenaming ? (
                <div
                  data-file-name-region
                  className="mt-2 w-full"
                  onClick={(event) => event.stopPropagation()}
                >
                  <InlineRenameInput
                    initialValue={item.isFolder ? item.name : splitName.base}
                    ariaLabel={
                      item.isFolder
                        ? t('fileExplorer.renameFolder', 'Rename folder')
                        : t('fileExplorer.renameFile', 'Rename file')
                    }
                    onSubmit={(value) => onRenameSubmit?.(item.id, value)}
                    onCancel={() => onRenameCancel?.()}
                  />
                </div>
              ) : (
                <div
                  data-file-name-region
                  className={`w-full text-center text-foreground break-words ${nameClass.replace('mt-', 'pt-')}`}
                >
                  <span title={item.name}>{item.name}</span>
                </div>
              )}
            </div>
          )

          return (
            <React.Fragment key={item.id}>
              {renderItemWrapper?.(item, content) ?? content}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
})
