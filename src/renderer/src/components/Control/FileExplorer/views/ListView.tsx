import React from 'react'
import { useTranslation } from 'react-i18next'
import { getFileIcon } from './getFileIcon'
import type { GridViewItem } from './GridView'

export interface ListViewProps {
  items: GridViewItem[]
  onItemClick: (id: string, event: React.MouseEvent) => void
  onItemDoubleClick: (id: string, event: React.MouseEvent) => void
  onItemContextMenu: (id: string, event: React.MouseEvent) => void
  renderItemWrapper?: (item: GridViewItem, children: React.ReactNode) => React.ReactNode
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getTypeName(mimeType: string | undefined, isFolder: boolean): string {
  if (isFolder) return 'Folder'
  if (!mimeType) return 'File'
  const firstPart = mimeType.split('/')[0]
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1)
}

export function ListView({
  items,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  renderItemWrapper
}: ListViewProps): React.JSX.Element {
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

  return (
    <div className="flex flex-col p-2">
      {items.map((item) => {
        const content = (
          <div
            className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors hover:bg-content2/60 ${
              item.isSelected ? 'bg-primary/10' : ''
            }`}
            onClick={(e) => onItemClick(item.id, e)}
            onDoubleClick={(e) => onItemDoubleClick(item.id, e)}
            onContextMenu={(e) => onItemContextMenu(item.id, e)}
          >
            <div className="flex-shrink-0 text-default-500">
              {getFileIcon(item.mimeType, item.isFolder, 24)}
            </div>
            <div className="flex-1 truncate text-sm text-foreground" title={item.name}>
              {item.name}
            </div>
            <div className="w-24 flex-shrink-0 text-xs text-default-400 truncate">
              {getTypeName(item.mimeType, item.isFolder)}
            </div>
            <div className="w-20 flex-shrink-0 text-right text-xs text-default-400">
              {formatFileSize(item.size)}
            </div>
          </div>
        )

        return <React.Fragment key={item.id}>{renderItemWrapper?.(item, content) ?? content}</React.Fragment>
      })}
    </div>
  )
}
