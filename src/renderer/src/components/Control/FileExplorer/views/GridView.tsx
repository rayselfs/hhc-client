import React from 'react'
import { useTranslation } from 'react-i18next'
import { getFileIcon } from './getFileIcon'

export interface GridViewItem {
  id: string
  name: string
  isFolder: boolean
  mimeType?: string
  size?: number
  isSelected: boolean
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
      gridColsClass = 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))]'
      iconSize = 64
      nameClass = 'line-clamp-2 text-sm mt-2'
      break
    case 'medium-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,minmax(88px,1fr))]'
      iconSize = 40
      nameClass = 'line-clamp-2 text-xs mt-1'
      break
    case 'small-icon':
      gridColsClass = 'grid-cols-[repeat(auto-fill,minmax(56px,1fr))]'
      iconSize = 24
      nameClass = 'truncate text-xs mt-1'
      break
  }

  return (
    <div className={`grid gap-4 p-4 ${gridColsClass}`}>
      {items.map((item) => {
        const content = (
          <div
            className={`flex flex-col items-center justify-start rounded-lg p-2 cursor-pointer transition-colors hover:bg-content2/60 ${
              item.isSelected ? 'ring-2 ring-primary bg-primary/10' : ''
            }`}
            onClick={(e) => onItemClick(item.id, e)}
            onDoubleClick={(e) => onItemDoubleClick(item.id, e)}
            onContextMenu={(e) => onItemContextMenu(item.id, e)}
          >
            <div className="flex items-center justify-center text-default-500">
              {getFileIcon(item.mimeType, item.isFolder, iconSize)}
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
