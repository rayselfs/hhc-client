import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, RotateCcw } from 'lucide-react'
import {
  useFileExplorerStore,
  useTrashExplorerSettings,
  permanentDeleteFolderFromStore,
  permanentDeleteFileItemFromStore
} from '@renderer/stores/file-explorer'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { GridView, ListView } from '@renderer/components/Control/FileExplorer/views'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import type { SortField } from '@renderer/stores/file-explorer'

type TrashEntry =
  | { kind: 'folder'; folder: FolderRecord }
  | { kind: 'file'; item: FileItemRecord }

function compareTrashByField(
  a: TrashEntry,
  b: TrashEntry,
  field: SortField,
  dir: 'asc' | 'desc'
): number {
  const sign = dir === 'asc' ? 1 : -1
  const nameA = a.kind === 'folder' ? a.folder.name : a.item.name
  const nameB = b.kind === 'folder' ? b.folder.name : b.item.name
  const sizeA = a.kind === 'file' ? a.item.size : 0
  const sizeB = b.kind === 'file' ? b.item.size : 0
  const createdAtA = a.kind === 'folder' ? a.folder.createdAt : a.item.createdAt
  const createdAtB = b.kind === 'folder' ? b.folder.createdAt : b.item.createdAt
  switch (field) {
    case 'name':
      return sign * nameA.localeCompare(nameB)
    case 'createdAt':
      return sign * (createdAtA - createdAtB)
    case 'size':
      return sign * (sizeA - sizeB)
    case 'kind': {
      const kindA = a.kind === 'folder' ? 'folder' : (a.item.mimeType ?? '')
      const kindB = b.kind === 'folder' ? 'folder' : (b.item.mimeType ?? '')
      return sign * kindA.localeCompare(kindB)
    }
  }
}

export default function TrashPage(): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { showMenu } = useContextMenu()
  const foldersArray = useFileExplorerStore((state) => state._foldersArray)
  const itemsArray = useFileExplorerStore((state) => state._itemsArray)
  const restoreFolder = useFileExplorerStore((state) => state.restoreFolder)
  const restoreItem = useFileExplorerStore((state) => state.restoreItem)
  const viewMode = useTrashExplorerSettings((state) => state.viewMode)
  const sortField = useTrashExplorerSettings((state) => state.sortField)
  const sortDir = useTrashExplorerSettings((state) => state.sortDir)
  const setSortDir = useTrashExplorerSettings((state) => state.setSortDir)
  const setSortFieldAndDir = useTrashExplorerSettings((state) => state.setSortFieldAndDir)
  const colWidths = useTrashExplorerSettings((state) => state.colWidths)
  const setColWidths = useTrashExplorerSettings((state) => state.setColWidths)

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
    const all = [...folders, ...files]
    if (sortDir !== 'none') {
      all.sort((a, b) => compareTrashByField(a, b, sortField, sortDir))
    } else {
      all.sort((a, b) => {
        const ta = a.kind === 'folder' ? (a.folder.deletedAt ?? 0) : (a.item.deletedAt ?? 0)
        const tb = b.kind === 'folder' ? (b.folder.deletedAt ?? 0) : (b.item.deletedAt ?? 0)
        return tb - ta
      })
    }
    return all
  }, [foldersArray, itemsArray, sortField, sortDir])

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

  const gridItems = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.kind === 'folder' ? entry.folder.id : entry.item.id,
        name: entry.kind === 'folder' ? entry.folder.name : entry.item.name,
        isFolder: entry.kind === 'folder',
        mimeType: entry.kind === 'file' ? entry.item.mimeType : undefined,
        size: entry.kind === 'file' ? entry.item.size : undefined,
        createdAt: entry.kind === 'folder' ? entry.folder.createdAt : entry.item.createdAt,
        isSelected: false
      })),
    [entries]
  )

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sortDir === 'none' || field !== sortField) {
        setSortFieldAndDir(field, 'asc')
      } else if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        setSortDir('asc')
      }
    },
    [sortField, sortDir, setSortDir, setSortFieldAndDir]
  )

  const handleItemContextMenuById = useCallback(
    (id: string, event: React.MouseEvent): void => {
      const entry = entries.find((e) => (e.kind === 'folder' ? e.folder.id : e.item.id) === id)
      if (!entry) return
      handleContextMenu(entry, event)
    },
    [entries, handleContextMenu]
  )

  const handleItemClick = useCallback((_id: string, _event: React.MouseEvent): void => {}, [])
  const handleItemDoubleClick = useCallback(
    (_id: string, _event: React.MouseEvent): void => {},
    []
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
    <div className="h-full overflow-auto">
      {viewMode === 'list' ? (
        <ListView
          items={gridItems}
          sortField={sortField}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          colWidths={colWidths}
          onColWidthChange={(col, w) => setColWidths({ [col]: w })}
          onItemClick={handleItemClick}
          onItemDoubleClick={handleItemDoubleClick}
          onItemContextMenu={handleItemContextMenuById}
        />
      ) : (
        <GridView
          items={gridItems}
          viewMode={viewMode}
          onItemClick={handleItemClick}
          onItemDoubleClick={handleItemDoubleClick}
          onItemContextMenu={handleItemContextMenuById}
        />
      )}
    </div>
  )
}
