import React from 'react'
import { Folder } from 'lucide-react'
import { Skeleton } from '@heroui/react/skeleton'
import { useTranslation } from 'react-i18next'
import { getFileIcon } from './getFileIcon'

export interface GridViewItem {
  id: string
  name: string
  isFolder: boolean
  mimeType?: string
  size?: number
  createdAt?: number
  thumbnailUrl?: string | null
  isSelected: boolean
}

function canHaveThumbnail(mimeType: string | undefined): boolean {
  return (
    mimeType?.startsWith('image/') === true ||
    mimeType?.startsWith('video/') === true ||
    mimeType === 'application/pdf'
  )
}

function renderGridIcon(item: GridViewItem, iconSize: number): React.ReactNode {
  if (item.isFolder) {
    return <Folder size={iconSize} className="text-accent" fill="currentColor" />
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

export interface GridViewProps {
  items: GridViewItem[]
  viewMode: 'large-icon' | 'medium-icon' | 'small-icon'
  onItemClick: (id: string, event: React.MouseEvent) => void
  onItemDoubleClick: (id: string, event: React.MouseEvent) => void
  onItemContextMenu: (id: string, event: React.MouseEvent) => void
  renderItemWrapper?: (item: GridViewItem, children: React.ReactNode) => React.ReactNode
}

export function GridView({
  items,
  viewMode,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  renderItemWrapper
}: GridViewProps): React.JSX.Element {
  const { t } = useTranslation()

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

  let gridColsClass = ''
  let iconSize = 32
  let nameClass = ''

  switch (viewMode) {
    case 'large-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,minmax(192px,1fr))]'
      iconSize = 96
      nameClass = 'line-clamp-2 text-base mt-2'
      break
    case 'medium-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))]'
      iconSize = 64
      nameClass = 'line-clamp-2 text-sm mt-2'
      break
    case 'small-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,minmax(88px,1fr))]'
      iconSize = 40
      nameClass = 'line-clamp-2 text-xs mt-1'
      break
  }

  return (
    <div className={`grid gap-4 p-4 ${gridColsClass}`}>
      {items.map((item) => {
        const content = (
          <div
            className={`flex flex-col items-center justify-start rounded-lg p-2 cursor-pointer transition-colors hover:bg-content2/60 ${
              item.isSelected ? 'bg-surface' : ''
            }`}
            onClick={(e) => onItemClick(item.id, e)}
            onDoubleClick={(e) => onItemDoubleClick(item.id, e)}
            onContextMenu={(e) => onItemContextMenu(item.id, e)}
          >
            <div className="flex items-center justify-center">
              {renderGridIcon(item, iconSize)}
            </div>
            <span
              className={`w-full text-center text-foreground break-words ${nameClass}`}
              title={item.name}
            >
              {item.name}
            </span>
          </div>
        )

        return (
          <React.Fragment key={item.id}>
            {renderItemWrapper?.(item, content) ?? content}
          </React.Fragment>
        )
      })}
    </div>
  )
}
