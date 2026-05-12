import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useFileExplorerSettings, useFileExplorerStore } from '@renderer/stores/file-explorer'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import { GridView, ListView, type GridViewItem } from './views'

export interface FileBrowserProps {
  onItemContextMenu?: (itemId: string, event: React.MouseEvent) => void
  onFolderContextMenu?: (folderId: string, event: React.MouseEvent) => void
  onEmptyAreaContextMenu?: (event: React.MouseEvent) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  onCopy?: (selectedIds: Set<string>) => void
  onCut?: (selectedIds: Set<string>) => void
  onPaste?: () => void
}

type FileExplorerDndData =
  | { type: 'folder'; item: FolderRecord }
  | { type: 'item'; item: FileItemRecord }
  | { type: 'folder-dropzone'; folderId: string }

interface SortableViewItemProps {
  item: GridViewItem
  folder?: FolderRecord
  file?: FileItemRecord
  isDraggedAway: boolean
  isMultiDrag: boolean
  children: React.ReactNode
}

function isFileItemRecord(item: unknown): item is FileItemRecord {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    item.type === 'file' &&
    'name' in item &&
    'mimeType' in item &&
    'size' in item
  )
}

function SortableViewItem({
  item,
  folder,
  file,
  isDraggedAway,
  isMultiDrag,
  children
}: SortableViewItemProps): React.JSX.Element {
  const sortable = useSortable({
    id: item.id,
    data: item.isFolder
      ? ({ type: 'folder', item: folder } as FileExplorerDndData)
      : ({ type: 'item', item: file } as FileExplorerDndData)
  })
  const droppable = useDroppable({
    id: `drop-${item.id}`,
    data: { type: 'folder-dropzone', folderId: item.id } as FileExplorerDndData,
    disabled: !item.isFolder || isDraggedAway
  })

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      sortable.setNodeRef(el)
      if (item.isFolder) droppable.setNodeRef(el)
    },
    [item.isFolder, sortable, droppable]
  )

  const style: React.CSSProperties = {
    transform: isMultiDrag ? undefined : CSS.Transform.toString(sortable.transform),
    transition: isMultiDrag ? undefined : sortable.transition,
    opacity: sortable.isDragging || isDraggedAway ? 0.4 : 1
  }

  return (
    <div
      ref={setRef}
      style={style}
      className="touch-none"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      {children}
    </div>
  )
}

function DragOverlayContent({ name, count }: { name: string; count: number }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-content1 px-3 py-2 text-sm text-foreground shadow-lg ring-1 ring-border">
      {count > 1 ? `${count} items` : name}
    </div>
  )
}

export function FileBrowser({
  onItemContextMenu,
  onFolderContextMenu,
  onEmptyAreaContextMenu,
  onSelectionChange,
  onCopy,
  onCut,
  onPaste
}: FileBrowserProps): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const foldersArray = useFileExplorerStore((state) => state._foldersArray)
  const itemsArray = useFileExplorerStore((state) => state._itemsArray)
  const navigateToFolder = useFileExplorerStore((state) => state.navigateToFolder)
  const moveItem = useFileExplorerStore((state) => state.moveItem)
  const moveFolder = useFileExplorerStore((state) => state.moveFolder)
  const reorderItems = useFileExplorerStore((state) => state.reorderItems)
  const reorderFolders = useFileExplorerStore((state) => state.reorderFolders)
  const removeItem = useFileExplorerStore((state) => state.removeItem)
  const deleteFolder = useFileExplorerStore((state) => state.deleteFolder)
  const viewMode = useFileExplorerSettings((state) => state.viewMode)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 }
    })
  )

  const folders = useMemo(
    () => foldersArray.filter((folder) => folder.parentId === currentFolderId),
    [foldersArray, currentFolderId]
  )
  const fileItems = useMemo(
    () =>
      itemsArray.filter(
        (item): item is FileItemRecord => item.parentId === currentFolderId && isFileItemRecord(item)
      ),
    [itemsArray, currentFolderId]
  )

  const allItems: GridViewItem[] = useMemo(
    () => [
      ...folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        isFolder: true,
        isSelected: selectedIds.has(folder.id)
      })),
      ...fileItems.map((item) => ({
        id: item.id,
        name: item.name,
        isFolder: false,
        mimeType: item.mimeType,
        size: item.size,
        isSelected: selectedIds.has(item.id)
      }))
    ],
    [folders, fileItems, selectedIds]
  )

  const allIds = useMemo(() => allItems.map((item) => item.id), [allItems])
  const folderIds = useMemo(() => folders.map((folder) => folder.id), [folders])
  const itemIds = useMemo(() => fileItems.map((item) => item.id), [fileItems])
  const activeItem = activeId ? allItems.find((item) => item.id === activeId) : null
  const isMultiDrag = draggedIds.size > 1

  const handleItemClick = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      event.stopPropagation()

      if (event.shiftKey && lastSelectedId) {
        const lastIndex = allIds.indexOf(lastSelectedId)
        const currentIndex = allIds.indexOf(itemId)
        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)
          setSelectedIds(new Set(allIds.slice(start, end + 1)))
          return
        }
      }

      if (event.ctrlKey || event.metaKey) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(itemId)) {
            next.delete(itemId)
          } else {
            next.add(itemId)
          }
          return next
        })
      } else {
        setSelectedIds(new Set([itemId]))
      }

      setLastSelectedId(itemId)
    },
    [allIds, lastSelectedId]
  )

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [])

  const handleContainerClick = useCallback(
    (event: React.MouseEvent): void => {
      if (event.target === event.currentTarget) clearSelection()
    },
    [clearSelection]
  )

  const handleContainerContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      if (event.target !== event.currentTarget) return
      event.preventDefault()
      onEmptyAreaContextMenu?.(event)
    },
    [onEmptyAreaContextMenu]
  )

  const handleItemContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (!selectedIds.has(itemId)) setSelectedIds(new Set([itemId]))
      const item = allItems.find((entry) => entry.id === itemId)
      if (item?.isFolder) {
        onFolderContextMenu?.(itemId, event)
      } else {
        onItemContextMenu?.(itemId, event)
      }
    },
    [allItems, selectedIds, onFolderContextMenu, onItemContextMenu]
  )

  const handleItemDoubleClick = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      event.stopPropagation()
      const item = allItems.find((entry) => entry.id === itemId)
      if (item?.isFolder) void navigateToFolder(itemId)
    },
    [allItems, navigateToFolder]
  )

  const handleSelectAll = useCallback((): void => {
    setSelectedIds(new Set(allIds))
  }, [allIds])

  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selectedIds.size === 0) return

    const confirmed = await confirm({
      title: t('folder.deleteSelectedTitle', {
        count: selectedIds.size,
        defaultValue: `Delete ${selectedIds.size} item(s)?`
      }),
      description: t('folder.deleteItemDescription', 'This action cannot be undone.'),
      status: 'danger'
    })

    if (!confirmed) return

    for (const id of selectedIds) {
      if (folderIds.includes(id)) {
        deleteFolder(id)
      } else {
        removeItem(id)
      }
    }
    clearSelection()
  }, [selectedIds, confirm, t, folderIds, deleteFolder, removeItem, clearSelection])

  const handleCopySelected = useCallback((): void => {
    if (selectedIds.size === 0) return
    onCopy?.(selectedIds)
  }, [selectedIds, onCopy])

  const handleCutSelected = useCallback((): void => {
    if (selectedIds.size === 0) return
    onCut?.(selectedIds)
  }, [selectedIds, onCut])

  const handlePasteSelected = useCallback((): void => {
    onPaste?.()
  }, [onPaste])

  useKeyboardShortcuts(
    [
      { config: SHORTCUTS.EDIT.SELECT_ALL, handler: handleSelectAll, preventDefault: true },
      { config: SHORTCUTS.EDIT.COPY, handler: handleCopySelected, preventDefault: true },
      { config: SHORTCUTS.EDIT.CUT, handler: handleCutSelected, preventDefault: true },
      { config: SHORTCUTS.EDIT.PASTE, handler: handlePasteSelected, preventDefault: true },
      { config: SHORTCUTS.EDIT.ESCAPE, handler: clearSelection, preventDefault: true },
      {
        config: SHORTCUTS.EDIT.DELETE,
        handler: () => void handleDeleteSelected(),
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE_ALT,
        handler: () => void handleDeleteSelected(),
        preventDefault: true
      }
    ],
    { enabled: true, sectionKey: 'edit' }
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent): void => {
      const nextActiveId = String(event.active.id)
      setActiveId(nextActiveId)

      if (selectedIds.has(nextActiveId)) {
        setDraggedIds(new Set(selectedIds))
      } else {
        setSelectedIds(new Set([nextActiveId]))
        setDraggedIds(new Set([nextActiveId]))
        setLastSelectedId(nextActiveId)
      }
    },
    [selectedIds]
  )

  const handleDragOver = useCallback((): void => {}, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const currentDraggedIds = draggedIds
      setActiveId(null)
      setDraggedIds(new Set())

      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeData = active.data.current as FileExplorerDndData | undefined
      const overData = over.data.current as FileExplorerDndData | undefined
      if (!activeData) return

      if (overData?.type === 'folder-dropzone') {
        const targetFolderId = overData.folderId
        for (const id of currentDraggedIds.size > 0
          ? currentDraggedIds
          : new Set([String(active.id)])) {
          if (id === targetFolderId) continue
          if (folderIds.includes(id)) {
            moveFolder(id, targetFolderId)
          } else {
            moveItem(id, targetFolderId)
          }
        }
        return
      }

      if (currentDraggedIds.size > 1) return

      if (activeData.type === 'folder' && overData?.type === 'folder') {
        const oldIndex = folderIds.indexOf(String(active.id))
        const newIndex = folderIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderFolders(currentFolderId, arrayMove(folderIds, oldIndex, newIndex))
        }
        return
      }

      if (activeData.type === 'item' && overData?.type === 'item') {
        const oldIndex = itemIds.indexOf(String(active.id))
        const newIndex = itemIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderItems(currentFolderId, arrayMove(itemIds, oldIndex, newIndex))
        }
      }
    },
    [
      draggedIds,
      folderIds,
      itemIds,
      currentFolderId,
      moveFolder,
      moveItem,
      reorderFolders,
      reorderItems
    ]
  )

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const folderDropZones = args.droppableContainers.filter((container) => {
      const data = container.data.current as FileExplorerDndData | undefined
      if (data?.type !== 'folder-dropzone') return false
      if (args.active && container.id === `drop-${String(args.active.id)}`) return false
      return true
    })
    const folderHits = pointerWithin({ ...args, droppableContainers: folderDropZones })
    if (folderHits.length > 0) return folderHits
    return closestCenter(args)
  }, [])

  const renderItemWrapper = useCallback(
    (item: GridViewItem, children: React.ReactNode): React.ReactNode => {
      const folder = folders.find((entry) => entry.id === item.id)
      const file = fileItems.find((entry) => entry.id === item.id)
      return (
        <SortableViewItem
          item={item}
          folder={folder}
          file={file}
          isDraggedAway={draggedIds.has(item.id)}
          isMultiDrag={isMultiDrag}
        >
          {children}
        </SortableViewItem>
      )
    },
    [folders, fileItems, draggedIds, isMultiDrag]
  )

  return (
    <div ref={containerRef} className="h-full" onClick={handleContainerClick}>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="min-h-full"
          onClick={handleContainerClick}
          onContextMenu={handleContainerContextMenu}
        >
          <SortableContext items={[...folderIds, ...itemIds]}>
            {viewMode === 'list' ? (
              <ListView
                items={allItems}
                onItemClick={handleItemClick}
                onItemDoubleClick={handleItemDoubleClick}
                onItemContextMenu={handleItemContextMenu}
                renderItemWrapper={renderItemWrapper}
              />
            ) : (
              <GridView
                items={allItems}
                viewMode={viewMode}
                onItemClick={handleItemClick}
                onItemDoubleClick={handleItemDoubleClick}
                onItemContextMenu={handleItemContextMenu}
                renderItemWrapper={renderItemWrapper}
              />
            )}
          </SortableContext>
        </div>
        <DragOverlay>
          {activeItem ? (
            <DragOverlayContent name={activeItem.name} count={draggedIds.size || 1} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default FileBrowser
