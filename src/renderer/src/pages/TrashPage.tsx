import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@heroui/react/button'
import { Input } from '@heroui/react/input'
import { Label } from '@heroui/react/label'
import { Modal } from '@heroui/react/modal'
import { TextField } from '@heroui/react/textfield'
import {
  FILE_EXPLORER_ROOT_ID,
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
import { hasNameConflict, validateDisplayName } from '@renderer/lib/file-naming'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

type TrashEntry = { kind: 'folder'; folder: FolderRecord } | { kind: 'file'; item: FileItemRecord }

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
  const foldersById = useFileExplorerStore((state) => state.folders)
  const restoreFolder = useFileExplorerStore((state) => state.restoreFolder)
  const restoreItem = useFileExplorerStore((state) => state.restoreItem)
  const viewMode = useTrashExplorerSettings((state) => state.viewMode)
  const sortField = useTrashExplorerSettings((state) => state.sortField)
  const sortDir = useTrashExplorerSettings((state) => state.sortDir)
  const setSortDir = useTrashExplorerSettings((state) => state.setSortDir)
  const setSortFieldAndDir = useTrashExplorerSettings((state) => state.setSortFieldAndDir)
  const colWidths = useTrashExplorerSettings((state) => state.colWidths)
  const setColWidths = useTrashExplorerSettings((state) => state.setColWidths)
  const [restoreConflict, setRestoreConflict] = useState<{
    entry: TrashEntry
    targetParentId: string
    name: string
  } | null>(null)

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

  const getRestoreTargetParentId = useCallback(
    (originalParentId: string | null | undefined): string => {
      return originalParentId &&
        foldersById[originalParentId] &&
        !foldersById[originalParentId].deletedAt
        ? originalParentId
        : FILE_EXPLORER_ROOT_ID
    },
    [foldersById]
  )

  const getActiveSiblingNames = useCallback(
    (entry: TrashEntry, targetParentId: string): string[] => {
      if (entry.kind === 'folder') {
        return foldersArray
          .filter(
            (folder) =>
              folder.parentId === targetParentId &&
              !folder.deletedAt &&
              folder.id !== entry.folder.id
          )
          .map((folder) => folder.name)
      }
      return itemsArray
        .filter(
          (item): item is FileItemRecord =>
            item.type === 'file' &&
            item.parentId === targetParentId &&
            !item.deletedAt &&
            item.id !== entry.item.id
        )
        .map((item) => item.name)
    },
    [foldersArray, itemsArray]
  )

  const restoreEntry = useCallback(
    (entry: TrashEntry, name?: string): void => {
      const trimmedName = name?.trim()
      if (entry.kind === 'folder') {
        if (trimmedName && trimmedName !== entry.folder.name) {
          useFileExplorerStore.getState().updateFolder(entry.folder.id, { name: trimmedName })
        }
        restoreFolder(entry.folder.id)
      } else {
        if (trimmedName && trimmedName !== entry.item.name) {
          useFileExplorerStore.getState().updateItem?.(entry.item.id, { name: trimmedName })
        }
        restoreItem(entry.item.id)
      }
    },
    [restoreFolder, restoreItem]
  )

  const requestRestoreEntry = useCallback(
    (entry: TrashEntry): boolean => {
      const originalParentId =
        entry.kind === 'folder' ? entry.folder.originalParentId : entry.item.originalParentId
      const targetParentId = getRestoreTargetParentId(originalParentId)
      const name = entry.kind === 'folder' ? entry.folder.name : entry.item.name
      if (hasNameConflict(name, getActiveSiblingNames(entry, targetParentId))) {
        setRestoreConflict({ entry, targetParentId, name })
        return false
      }
      restoreEntry(entry)
      return true
    },
    [getActiveSiblingNames, getRestoreTargetParentId, restoreEntry]
  )

  const restoreSiblingNames = useMemo(
    () =>
      restoreConflict
        ? getActiveSiblingNames(restoreConflict.entry, restoreConflict.targetParentId)
        : [],
    [getActiveSiblingNames, restoreConflict]
  )

  const restoreName = restoreConflict?.name.trim() ?? ''
  const canSubmitRestore =
    !!restoreConflict &&
    validateDisplayName(restoreName) &&
    !hasNameConflict(restoreName, restoreSiblingNames)

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

  const requestRestoreIds = useCallback(
    (ids: Set<string>): void => {
      for (const id of ids) {
        const entry = entries.find((e) => (e.kind === 'folder' ? e.folder.id : e.item.id) === id)
        if (!entry) continue
        if (!requestRestoreEntry(entry)) return
      }
      clearSelection()
    },
    [clearSelection, entries, requestRestoreEntry]
  )

  const submitRestoreConflict = useCallback((): void => {
    if (!restoreConflict || !canSubmitRestore) return
    restoreEntry(restoreConflict.entry, restoreName)
    setRestoreConflict(null)
    clearSelection()
  }, [canSubmitRestore, clearSelection, restoreConflict, restoreEntry, restoreName])

  const gridItemsWithSelection = useMemo(
    () => gridItems.map((i) => ({ ...i, isSelected: selectedIds.has(i.id) })),
    [gridItems, selectedIds]
  )

  const permanentlyDeleteIds = useCallback(
    async (ids: Set<string>): Promise<void> => {
      if (ids.size === 0) return
      const confirmed = await confirm({
        title: t('trash.permanentDeleteTitle'),
        description: t('trash.permanentDeleteDescription'),
        status: 'danger'
      })
      if (!confirmed) return
      for (const id of ids) {
        const entry = entries.find((e) => (e.kind === 'folder' ? e.folder.id : e.item.id) === id)
        if (!entry) continue
        if (entry.kind === 'folder') {
          await permanentDeleteFolderFromStore(entry.folder.id)
        } else {
          await permanentDeleteFileItemFromStore(entry.item.id)
        }
      }
      clearSelection()
    },
    [clearSelection, confirm, entries, t]
  )

  const handleContextMenu = useCallback(
    (id: string, event: React.MouseEvent): void => {
      event.preventDefault()
      const isAlreadySelected = selectedIds.has(id)
      if (!isAlreadySelected) {
        setSelectedIds(new Set([id]))
      }
      const effectiveIds = isAlreadySelected && selectedIds.size > 1 ? selectedIds : new Set([id])

      showMenu(
        [
          {
            id: 'restore',
            label: t('fileExplorer.contextMenu.restore'),
            icon: React.createElement(RotateCcw, { size: 14 }),
            onAction: () => requestRestoreIds(effectiveIds)
          },
          'separator',
          {
            id: 'permanent-delete',
            label: t('fileExplorer.contextMenu.permanentDelete'),
            icon: React.createElement(Trash2, { size: 14 }),
            variant: 'danger',
            onAction: () => void permanentlyDeleteIds(effectiveIds)
          }
        ],
        event
      )
    },
    [showMenu, t, selectedIds, setSelectedIds, requestRestoreIds, permanentlyDeleteIds]
  )

  const handleContainerContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      if ((event.target as Element).closest('[data-file-item]')) return
      event.preventDefault()
      showMenu(
        [
          {
            id: 'empty-trash',
            label: t('trash.emptyTrash'),
            icon: React.createElement(Trash2, { size: 14 }),
            variant: 'danger',
            onAction: () => void permanentlyDeleteIds(new Set(allIds))
          }
        ],
        event
      )
    },
    [allIds, permanentlyDeleteIds, showMenu, t]
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
      { config: SHORTCUTS.EDIT.ESCAPE, handler: clearSelection, preventDefault: true },
      {
        config: SHORTCUTS.EDIT.DELETE,
        handler: () => void permanentlyDeleteIds(selectedIds),
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE_ALT,
        handler: () => void permanentlyDeleteIds(selectedIds),
        preventDefault: true
      }
    ],
    { enabled: true, sectionKey: 'trash' }
  )

  if (entries.length === 0) {
    return (
      <FileExplorerShell itemCount={0} selectedCount={0}>
        <div className="flex h-full flex-col items-center justify-center text-center p-8">
          <h3 className="text-lg font-medium text-foreground">{t('trash.empty.title')}</h3>
          <p className="text-sm text-default-400 mt-1">{t('trash.empty.description')}</p>
        </div>
      </FileExplorerShell>
    )
  }

  return (
    <>
      <FileExplorerShell itemCount={entries.length} selectedCount={selectedIds.size}>
        <div
          ref={containerRef}
          className="relative h-full overflow-auto"
          onClick={handleContainerClick}
          onMouseDown={handleContainerMouseDown}
          onContextMenu={handleContainerContextMenu}
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
      {restoreConflict && (
        <Modal>
          <Modal.Backdrop isOpen onOpenChange={() => setRestoreConflict(null)} isDismissable>
            <Modal.Container size="sm">
              <Modal.Dialog className="p-3 pl-5 pt-5">
                <Modal.Header>
                  <Modal.Heading>
                    {t('trash.restoreNameConflictTitle', 'Rename before restoring')}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <ShortcutScope name="overlay">
                    <TextField
                      autoFocus
                      value={restoreConflict.name}
                      onChange={(name) => setRestoreConflict({ ...restoreConflict, name })}
                      className="w-full p-1"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                          submitRestoreConflict()
                        }
                      }}
                      onFocus={(event) => (event.target as HTMLInputElement).select()}
                    >
                      <Label>{t('trash.restoreNameLabel', 'Name')}</Label>
                      <Input variant="secondary" />
                    </TextField>
                  </ShortcutScope>
                  <p className="px-1 text-xs text-default-500">
                    {t(
                      'trash.restoreNameConflictDescription',
                      'An item with this name already exists in the restore destination.'
                    )}
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="tertiary" onPress={() => setRestoreConflict(null)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={!canSubmitRestore}
                    onPress={submitRestoreConflict}
                  >
                    {t('common.confirm', 'Confirm')}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </>
  )
}
