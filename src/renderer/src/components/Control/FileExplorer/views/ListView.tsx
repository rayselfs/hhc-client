import React from 'react'
import { Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import { formatFileKind } from '@renderer/lib/format-file-kind'
import { getFileIcon } from './getFileIcon'
import type { GridViewItem } from './GridView'

export interface ListViewProps {
  items: GridViewItem[]
  onItemClick: (id: string, event: React.MouseEvent) => void
  onItemDoubleClick: (id: string, event: React.MouseEvent) => void
  onItemContextMenu: (id: string, event: React.MouseEvent) => void
  renderItemWrapper?: (item: GridViewItem, children: React.ReactNode) => React.ReactNode
}

function formatDate(ts: number | undefined): string {
  if (ts === undefined) return '—'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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
    <div className="flex flex-col">
      <div className="sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3 px-3 py-1.5">
          <div className="w-6 flex-shrink-0" />
          <div className="flex-1 text-xs font-medium text-default-400 uppercase tracking-wide">
            {t('fileExplorer.list.name', 'Name')}
          </div>
          <div className="w-28 flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide">
            {t('fileExplorer.list.createdAt', 'Created')}
          </div>
          <div className="w-20 flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide">
            {t('fileExplorer.list.size', 'Size')}
          </div>
          <div className="w-24 flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide">
            {t('fileExplorer.list.kind', 'Kind')}
          </div>
        </div>
        <GlassDivider />
      </div>

      <div className="flex flex-col p-2">
        {items.map((item) => {
          const content = (
            <div
              className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors hover:bg-content2/60 ${
                item.isSelected ? 'bg-surface' : ''
              }`}
              onClick={(e) => onItemClick(item.id, e)}
              onDoubleClick={(e) => onItemDoubleClick(item.id, e)}
              onContextMenu={(e) => onItemContextMenu(item.id, e)}
            >
              <div className="flex-shrink-0 w-6 flex items-center justify-center">
                {item.isFolder ? (
                  <Folder size={20} className="text-accent" fill="currentColor" />
                ) : (
                  <div className="text-default-500">
                    {getFileIcon(item.mimeType, item.isFolder, 20)}
                  </div>
                )}
              </div>
              <div className="flex-1 truncate text-sm text-foreground" title={item.name}>
                {item.name}
              </div>
              <div className="w-28 flex-shrink-0 text-xs text-default-400">
                {formatDate(item.createdAt)}
              </div>
              <div className="w-20 flex-shrink-0 text-xs text-default-400">
                {item.isFolder ? '—' : formatFileSize(item.size)}
              </div>
              <div className="w-24 flex-shrink-0 text-xs text-default-400 truncate">
                {formatFileKind(item.mimeType, item.isFolder)}
              </div>
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
}
