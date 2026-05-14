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
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useItemSelection } from '@renderer/hooks/useItemSelection'
import { useThumbnails, canHaveThumbnail } from '@renderer/hooks/useThumbnails'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { compareByField } from '@renderer/lib/file-explorer-sort'
import { GridView, ListView } from '@renderer/components/Control/FileExplorer/views'
import FileExplorerShell from '@renderer/components/Control/FileExplorer/FileExplorerShell'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import type { SortField } from '@renderer/stores/file-explorer'
import type { SortableItem } from '@renderer/lib/file-explorer-sort'

type TrashEntry =
  | { kind: 'folder'; folder: FolderRecord }
  | { kind: 'file'; item: FileItemRecord }

function toSortable(e: TrashEntry): SortableItem {
  return {
    name: e.kind === 'folder' ? e.folder.name : e.item.name,
    size: e.kind === 'file' ? e.item.size : undefined,
    createdAt: e.kind === 'folder' ? e.folder.createdAt : e.item.createdAt,
    mimeType: e.kind === 'file' ? e.item.mimeType : undefined,
    isFolder: e.kind === 'folder'
  }
}

function compareTrashByField(
  a: TrashEntry,
  b: TrashEntry,
  field: SortField,
  dir: 'asc' | 'desc'
): number {
  return compareByField(toSortable(a), toSortable(b), field, dir)
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

  const thumbnailFileItems = useMemo(
    () =>
      entries
        .filter((e): e is { kind: 'file'; item: FileItemRecord } => e.kind === 'file')
        .map((e) => e.item),
    [entries]
  )

  const thumbnails = useThumbnails(thumbnailFileItems)

  const gridItems = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.kind === 'folder' ? entry.folder.id : entry.item.id,
        name: entry.kind === 'folder' ? entry.folder.name : entry.item.name,
        isFolder: entry.kind === 'folder',
        mimeType: entry.kind === 'file' ? entry.item.mimeType : undefined,
        size: entry.kind === 'file' ? entry.item.size : undefined,
        createdAt: entry.kind === 'folder' ? entry.folder.createdAt : entry.item.createdAt,
        thumbnailUrl:
          entry.kind === 'file' && canHaveThumbnail(entry.item.mimeType)
            ? thumbnails[entry.item.id]
            : null,
        isSelected: false
      })),
    [entries, thumbnails]
  )

  const allIds = useMemo(() => gridItems.map((i) => i.id), [gridItems])

  const {
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectAll,
    handleItemClick,
    handleContainerClick,
    handleContainerMouseDown,
    rubberBandRect,
    containerRef
  } = useItemSelection(allIds)

  const gridItemsWithSelection = useMemo(
    () => gridItems.map((i) => ({ ...i, isSelected: selectedIds.has(i.id) })),
    [gridItems, selectedIds]
  )

  const handleContextMenu = useCallback(
    (id: string, event: React.MouseEvent): void => {
      event.preventDefault()
      const isAlreadySelected = selectedIds.has(id)
      if (!isAlreadySelected) {
        setSelectedIds(new Set([id]))
      }
      const effectiveIds =
        isAlreadySelected && selectedIds.size > 1 ? selectedIds : new Set([id])

      showMenu(
        [
          {
            id: 'restore',
            label: t('fileExplorer.contextMenu.restore'),
            icon: React.createElement(RotateCcw, { size: 14 }),
            onAction: () => {
              for (const eid of effectiveIds) {
                const entry = entries.find(
                  (e) => (e.kind === 'folder' ? e.folder.id : e.item.id) === eid
                )
                if (!entry) continue
                if (entry.kind === 'folder') restoreFolder(entry.folder.id)
                else restoreItem(entry.item.id)
              }
              clearSelection()
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
              for (const eid of effectiveIds) {
                const entry = entries.find(
                  (e) => (e.kind === 'folder' ? e.folder.id : e.item.id) === eid
                )
                if (!entry) continue
                if (entry.kind === 'folder') {
                  await permanentDeleteFolderFromStore(entry.folder.id)
                } else {
                  await permanentDeleteFileItemFromStore(entry.item.id)
                }
              }
              clearSelection()
            }
          }
        ],
        event
      )
    },
    [
      showMenu,
      t,
      restoreFolder,
      restoreItem,
      confirm,
      entries,
      selectedIds,
      setSelectedIds,
      clearSelection
    ]
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

  useKeyboardShortcuts(
    [
      { config: SHORTCUTS.EDIT.SELECT_ALL, handler: selectAll, preventDefault: true },
      { config: SHORTCUTS.EDIT.ESCAPE, handler: clearSelection, preventDefault: true }
    ],
    { enabled: true, sectionKey: 'trash' }
  )

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <h3 className="text-lg font-medium text-foreground">{t('trash.empty.title')}</h3>
        <p className="text-sm text-default-400 mt-1">{t('trash.empty.description')}</p>
      </div>
    )
  }

  return (
    <FileExplorerShell itemCount={entries.length} selectedCount={selectedIds.size}>
      <div
        ref={containerRef}
        className="relative h-full overflow-auto"
        onClick={handleContainerClick}
        onMouseDown={handleContainerMouseDown}
      >
      {viewMode === 'list' ? (
        <ListView
          items={gridItemsWithSelection}
          sortField={sortField}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          colWidths={colWidths}
          onColWidthChange={(col, w) => setColWidths({ [col]: w })}
          onItemClick={handleItemClick}
          onItemDoubleClick={(_id, _e) => {}}
          onItemContextMenu={handleContextMenu}
        />
      ) : (
        <GridView
          items={gridItemsWithSelection}
          viewMode={viewMode}
          onItemClick={handleItemClick}
          onItemDoubleClick={(_id, _e) => {}}
          onItemContextMenu={handleContextMenu}
        />
      )}

      {rubberBandRect && (
          <div
            className="pointer-events-none fixed z-50 rounded-sm border border-primary/60 bg-accent/20"
            style={{
              left: rubberBandRect.left,
              top: rubberBandRect.top,
              width: rubberBandRect.width,
              height: rubberBandRect.height
            }}
          />
        )}
      </div>
    </FileExplorerShell>
  )
}
