import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, Trash2, RotateCcw } from 'lucide-react'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import {
  permanentDeleteFolderFromStore,
  permanentDeleteFileItemFromStore
} from '@renderer/stores/file-explorer'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { getFileIcon } from '@renderer/components/Control/FileExplorer/views/getFileIcon'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'

type TrashEntry =
  | { kind: 'folder'; folder: FolderRecord }
  | { kind: 'file'; item: FileItemRecord }

function formatDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function TrashPage(): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { showMenu } = useContextMenu()
  const foldersArray = useFileExplorerStore((state) => state._foldersArray)
  const itemsArray = useFileExplorerStore((state) => state._itemsArray)
  const restoreFolder = useFileExplorerStore((state) => state.restoreFolder)
  const restoreItem = useFileExplorerStore((state) => state.restoreItem)

  useEffect(() => {
    void useFileExplorerStore.getState().initialize()
  }, [])

  const entries: TrashEntry[] = useMemo(() => {
    const folders: TrashEntry[] = foldersArray
      .filter((f) => !!f.deletedAt)
      .map((f) => ({ kind: 'folder', folder: f }))
    const files: TrashEntry[] = itemsArray
      .filter((i): i is FileItemRecord => i.type === 'file' && !!i.deletedAt)
      .map((i) => ({ kind: 'file', item: i }))
    return [...folders, ...files].sort((a, b) => {
      const ta = a.kind === 'folder' ? (a.folder.deletedAt ?? 0) : (a.item.deletedAt ?? 0)
      const tb = b.kind === 'folder' ? (b.folder.deletedAt ?? 0) : (b.item.deletedAt ?? 0)
      return tb - ta
    })
  }, [foldersArray, itemsArray])

  const handleContextMenu = useCallback(
    (entry: TrashEntry, event: React.MouseEvent): void => {
      event.preventDefault()
      showMenu(
        [
          {
            id: 'restore',
            label: t('fileExplorer.contextMenu.restore'),
            icon: React.createElement(RotateCcw, { size: 14 }),
            onAction: () => {
              if (entry.kind === 'folder') restoreFolder(entry.folder.id)
              else restoreItem(entry.item.id)
            }
          },
          'separator',
          {
            id: 'permanent-delete',
            label: t('fileExplorer.contextMenu.permanentDelete'),
            icon: React.createElement(Trash2, { size: 14 }),
            variant: 'danger',
            onAction: async () => {
              const confirmed = await confirm({
                title: t('trash.permanentDeleteTitle'),
                description: t('trash.permanentDeleteDescription'),
                status: 'danger'
              })
              if (!confirmed) return
              if (entry.kind === 'folder') {
                await permanentDeleteFolderFromStore(entry.folder.id)
              } else {
                await permanentDeleteFileItemFromStore(entry.item.id)
              }
            }
          }
        ],
        event
      )
    },
    [showMenu, t, restoreFolder, restoreItem, confirm]
  )

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <Trash2 size={48} className="text-default-300 mb-4" />
        <h3 className="text-lg font-medium text-foreground">{t('trash.empty.title')}</h3>
        <p className="text-sm text-default-400 mt-1">{t('trash.empty.description')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="sticky top-0 bg-background z-10 border-b border-default-200">
        <div className="flex items-center px-3 py-1.5">
          <div className="w-6 flex-shrink-0 mr-3" />
          <div className="flex-1 min-w-0 text-xs font-medium text-default-400 uppercase tracking-wide">
            {t('fileExplorer.list.name')}
          </div>
          <div className="w-24 flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide pl-2">
            {t('fileExplorer.list.createdAt')}
          </div>
          <div className="w-20 flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide pl-2">
            {t('fileExplorer.list.size')}
          </div>
        </div>
      </div>

      <div className="flex flex-col p-2">
        {entries.map((entry) => {
          const id = entry.kind === 'folder' ? entry.folder.id : entry.item.id
          const name = entry.kind === 'folder' ? entry.folder.name : entry.item.name
          const createdAt =
            entry.kind === 'folder' ? entry.folder.createdAt : entry.item.createdAt
          const size = entry.kind === 'file' ? entry.item.size : undefined
          const mimeType = entry.kind === 'file' ? entry.item.mimeType : undefined

          return (
            <div
              key={id}
              className="flex items-center rounded-md px-3 py-2 cursor-default transition-colors hover:bg-content2/60"
              onContextMenu={(e) => void handleContextMenu(entry, e)}
            >
              <div className="flex-shrink-0 w-6 flex items-center justify-center mr-3">
                {entry.kind === 'folder' ? (
                  <Folder size={20} className="text-accent" fill="currentColor" />
                ) : (
                  <div className="text-danger">{getFileIcon(mimeType, false, 20)}</div>
                )}
              </div>
              <div className="flex-1 min-w-0 truncate text-sm text-foreground" title={name}>
                {name}
              </div>
              <div className="w-24 flex-shrink-0 text-sm text-default-400 pl-2">
                {formatDate(createdAt)}
              </div>
              <div className="w-20 flex-shrink-0 text-sm text-default-400 pl-2">
                {size !== undefined ? formatSize(size) : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
