import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Folder, Upload } from 'lucide-react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useItemSelection } from '@renderer/hooks/useItemSelection'
import { useOsFileDrop } from '@renderer/hooks/useOsFileDrop'
import { useThumbnails, canHaveThumbnail } from '@renderer/hooks/useThumbnails'
import { compareByField } from '@renderer/lib/file-explorer-sort'
import { searchAllItems } from '@renderer/lib/file-explorer-search'
import {
  deleteFolderFromStore,
  removeFileItemFromStore,
  useFileExplorerCustomOrder,
  useFileExplorerSearch,
  useFileExplorerSettings,
  useFileExplorerStore
} from '@renderer/stores/file-explorer'
import { uploadFromDataTransfer } from '@renderer/lib/upload-utils'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import type { ClipboardState } from '@renderer/components/Control/FileExplorer'
import { getFileIcon } from './views/getFileIcon'
import { GridView, ListView, type GridViewItem } from './views'
import type { SearchResult } from '@renderer/lib/file-explorer-search'
import { formatFileKind } from '@renderer/lib/format-file-kind'
import { isPresentable, getPresentableItems } from '@renderer/lib/presentability'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import type { SortField } from '@renderer/stores/file-explorer'
import { hasNameConflict, splitFileName, validateDisplayName } from '@renderer/lib/file-naming'

export interface FileBrowserProps {
  onItemContextMenu?: (itemId: string, event: React.MouseEvent) => void
  onFolderContextMenu?: (folderId: string, event: React.MouseEvent) => void
  onEmptyAreaContextMenu?: (event: React.MouseEvent) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  onCopy?: (selectedIds: Set<string>) => void
  onCut?: (selectedIds: Set<string>) => void
  onPaste?: () => void
  clipboard?: ClipboardState | null
  onEscape?: () => void
  renameItemRequestId?: string | null
  onRenameItemRequestHandled?: () => void
  isCurrentFolderReadOnly?: boolean
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
  isCut?: boolean
  isOsDragTarget?: boolean
  onPointerDown?: (itemId: string, event: React.PointerEvent) => void
  onPointerMove?: (itemId: string, event: React.PointerEvent) => void
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
  isCut,
  isOsDragTarget,
  onPointerDown,
  onPointerMove,
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
    opacity: sortable.isDragging || isDraggedAway ? 0.4 : isCut ? 0.4 : 1
  }

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      onPointerDown?.(item.id, event)
      sortable.listeners?.onPointerDown?.(event)
    },
    [item.id, onPointerDown, sortable.listeners]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      onPointerMove?.(item.id, event)
      sortable.listeners?.onPointerMove?.(event)
    },
    [item.id, onPointerMove, sortable.listeners]
  )

  return (
    <div
      ref={setRef}
      style={style}
      data-file-item
      data-item-id={item.id}
      {...(item.isFolder ? { 'data-folder-id': item.id } : {})}
      className={`touch-none rounded-lg${isOsDragTarget ? ' ring-2 ring-inset ring-primary/50' : ''}${droppable.isOver && item.isFolder ? ' bg-surface' : ''}`}
      {...sortable.attributes}
      {...sortable.listeners}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {children}
    </div>
  )
}

function DragOverlayContent({
  name,
  count,
  isFolder,
  mimeType
}: {
  name: string
  count: number
  isFolder: boolean
  mimeType?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg bg-default-100 px-3 py-2 text-sm text-foreground shadow-lg ring-1 ring-border flex items-center gap-2">
      <div className="flex-shrink-0">
        {isFolder ? (
          <Folder size={16} className="text-accent" fill="currentColor" />
        ) : (
          <div className="text-danger">{getFileIcon(mimeType, false, 16)}</div>
        )}
      </div>
      {count > 1 ? `${count} items` : name}
    </div>
  )
}

function formatSearchDate(ts: number | undefined): string {
  if (ts === undefined) return '—'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function formatSearchFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const SEARCH_COL = { created: 90, size: 72, kind: 96, path: 200 }
const EMPTY_ARRAY: never[] = []
const SLOW_CLICK_RENAME_MIN_MS = 320

function SearchResultsList({
  results,
  selectedId,
  onSelectId,
  onFileClick,
  onFolderClick
}: {
  results: SearchResult[]
  selectedId: string | null
  onSelectId: (id: string) => void
  onFileClick: (result: SearchResult & { kind: 'file' }) => void
  onFolderClick: (result: SearchResult & { kind: 'folder' }) => void
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 bg-background z-10 border-b border-default-200">
        <div className="flex items-center px-3 py-1.5">
          <div className="w-6 flex-shrink-0 mr-3" />
          <div className="flex-1 min-w-0 text-xs font-medium text-default-400 uppercase tracking-wide">
            {t('fileExplorer.list.name', 'Name')}
          </div>
          <div
            className="flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide pl-2"
            style={{ width: SEARCH_COL.created }}
          >
            {t('fileExplorer.list.createdAt', 'Created')}
          </div>
          <div
            className="flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide pl-2"
            style={{ width: SEARCH_COL.size }}
          >
            {t('fileExplorer.list.size', 'Size')}
          </div>
          <div
            className="flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide pl-2"
            style={{ width: SEARCH_COL.kind }}
          >
            {t('fileExplorer.list.kind', 'Kind')}
          </div>
          <div
            className="flex-shrink-0 text-xs font-medium text-default-400 uppercase tracking-wide pl-2"
            style={{ width: SEARCH_COL.path }}
          >
            {t('fileExplorer.list.path', 'Path')}
          </div>
        </div>
      </div>

      <div className="flex flex-col p-2">
        {results.map((result) => {
          const isFile = result.kind === 'file'
          const id = isFile ? result.item.id : result.folder.id
          const name = isFile ? result.item.name : result.folder.name
          const mimeType = isFile ? result.item.mimeType : undefined
          const size = isFile ? result.item.size : undefined
          const createdAt = isFile ? result.item.createdAt : result.folder.createdAt
          const isSelected = selectedId === id

          return (
            <div
              key={id}
              className={`flex items-center rounded-md px-3 py-2 cursor-default transition-colors hover:bg-content2/60 ${isSelected ? 'bg-surface' : ''}`}
              onClick={() => onSelectId(id)}
              onDoubleClick={() => {
                if (result.kind === 'file') onFileClick(result)
                else onFolderClick(result)
              }}
            >
              <div className="flex-shrink-0 w-6 flex items-center justify-center mr-3">
                {!isFile ? (
                  <Folder size={20} className="text-accent" fill="currentColor" />
                ) : (
                  <div className="text-danger">{getFileIcon(mimeType, false, 20)}</div>
                )}
              </div>
              <div className="flex-1 min-w-0 truncate text-sm text-foreground" title={name}>
                {name}
              </div>
              <div
                className="flex-shrink-0 text-sm text-default-400 pl-2"
                style={{ width: SEARCH_COL.created }}
              >
                {formatSearchDate(createdAt)}
              </div>
              <div
                className="flex-shrink-0 text-sm text-default-400 pl-2"
                style={{ width: SEARCH_COL.size }}
              >
                {!isFile ? '—' : formatSearchFileSize(size)}
              </div>
              <div
                className="flex-shrink-0 text-sm text-default-400 truncate pl-2"
                style={{ width: SEARCH_COL.kind }}
              >
                {formatFileKind(mimeType, !isFile, t)}
              </div>
              <div
                className="flex-shrink-0 text-sm text-default-400 truncate pl-2"
                style={{ width: SEARCH_COL.path }}
              >
                {result.folderPath}
              </div>
            </div>
          )
        })}
      </div>
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
  onPaste,
  clipboard,
  onEscape,
  renameItemRequestId,
  onRenameItemRequestHandled,
  isCurrentFolderReadOnly = false
}: FileBrowserProps): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const rawFolders = useFileExplorerStore(
    (s) => s._childFoldersByParent[s.currentFolderId] ?? EMPTY_ARRAY
  )
  const rawItems = useFileExplorerStore((s) => s._itemsByParent[s.currentFolderId] ?? EMPTY_ARRAY)
  const navigateToFolder = useFileExplorerStore((state) => state.navigateToFolder)
  const toggleFavorite = useFileExplorerStore((state) => state.toggleFavorite)
  const moveItem = useFileExplorerStore((state) => state.moveItem)
  const moveFolder = useFileExplorerStore((state) => state.moveFolder)
  const customOrders = useFileExplorerCustomOrder((state) => state.orders)
  const setCustomOrder = useFileExplorerCustomOrder((state) => state.setOrder)
  const viewMode = useFileExplorerSettings((state) => state.viewMode)
  const sortField = useFileExplorerSettings((state) => state.sortField)
  const sortDir = useFileExplorerSettings((state) => state.sortDir)
  const setSortDir = useFileExplorerSettings((state) => state.setSortDir)
  const setSortFieldAndDir = useFileExplorerSettings((state) => state.setSortFieldAndDir)
  const colWidths = useFileExplorerSettings((state) => state.colWidths)
  const setColWidths = useFileExplorerSettings((state) => state.setColWidths)
  const searchQuery = useFileExplorerSearch((state) => state.searchQuery)
  const setSearchQuery = useFileExplorerSearch((state) => state.setSearchQuery)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null)
  const renameClickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRenameItemIdRef = React.useRef<string | null>(null)
  const pointerRef = React.useRef<{
    itemId: string
    x: number
    y: number
    moved: boolean
  } | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 }
    })
  )

  const folders = useMemo(
    () =>
      rawFolders.filter((folder) => !folder.deletedAt).sort((a, b) => a.sortIndex - b.sortIndex),
    [rawFolders]
  )
  const fileItems = useMemo(
    () =>
      rawItems
        .filter((item): item is FileItemRecord => isFileItemRecord(item) && !item.deletedAt)
        .sort((a, b) => a.sortIndex - b.sortIndex),
    [rawItems]
  )
  const searchRevision = [
    ...rawFolders.map((folder) => `${folder.id}:${folder.name}:${folder.deletedAt ?? ''}`),
    ...rawItems.map(
      (item) => `${item.id}:${'name' in item ? item.name : ''}:${item.deletedAt ?? ''}`
    )
  ].join('|')

  const searchResults = useMemo(() => {
    void searchRevision
    if (!searchQuery.trim()) return []
    const raw = searchAllItems(
      searchQuery,
      useFileExplorerStore.getState(),
      t('fileExplorer.breadcrumb.root')
    )
    return [...raw].sort((a, b) => {
      const nameA = a.kind === 'file' ? a.item.name : a.folder.name
      const nameB = b.kind === 'file' ? b.item.name : b.folder.name
      return nameA.localeCompare(nameB)
    })
  }, [searchQuery, searchRevision, t])

  const thumbnails = useThumbnails(fileItems, { pendingAgeMs: 2 * 60 * 1000 })

  const allItems: GridViewItem[] = useMemo(
    () => [
      ...folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        isFolder: true,
        createdAt: folder.createdAt,
        isFavorited: folder.isFavorited,
        isSelected: false
      })),
      ...fileItems.map((item) => ({
        id: item.id,
        name: item.name,
        isFolder: false,
        mimeType: item.mimeType,
        size: item.size,
        createdAt: item.createdAt,
        thumbnailUrl: canHaveThumbnail(item.mimeType) ? thumbnails[item.id] : null,
        isSelected: false
      }))
    ],
    [folders, fileItems, thumbnails]
  )

  const sortedItems = useMemo(() => {
    const foldersSubset = allItems.filter((item) => item.isFolder)
    const filesSubset = allItems.filter((item) => !item.isFolder)
    if (sortDir !== 'none') {
      foldersSubset.sort((a, b) => compareByField(a, b, sortField, sortDir))
      filesSubset.sort((a, b) => compareByField(a, b, sortField, sortDir))
      return [...foldersSubset, ...filesSubset]
    }
    const customOrder = customOrders[currentFolderId]
    if (!customOrder) {
      return [...foldersSubset, ...filesSubset]
    }
    const itemMap = new Map(allItems.map((item) => [item.id, item]))
    const ordered: GridViewItem[] = []
    for (const id of customOrder) {
      const item = itemMap.get(id)
      if (item) ordered.push(item)
    }
    const orderedIds = new Set(customOrder)
    const newFolders = foldersSubset.filter((item) => !orderedIds.has(item.id))
    const newFiles = filesSubset.filter((item) => !orderedIds.has(item.id))
    return [...ordered, ...newFolders, ...newFiles]
  }, [allItems, sortField, sortDir, currentFolderId, customOrders])

  const sortedFileItems = useMemo(() => {
    const fileItemMap = new Map(fileItems.map((f) => [f.id, f]))
    return sortedItems
      .filter((item) => !item.isFolder)
      .map((item) => fileItemMap.get(item.id))
      .filter((item): item is FileItemRecord => item !== undefined)
  }, [sortedItems, fileItems])

  const allIds = useMemo(() => sortedItems.map((item) => item.id), [sortedItems])
  const folderIds = useMemo(
    () => sortedItems.filter((item) => item.isFolder).map((item) => item.id),
    [sortedItems]
  )
  const activeItem = activeId ? sortedItems.find((item) => item.id === activeId) : null
  const isMultiDrag = draggedIds.size > 1

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

  const {
    isOsDragOver,
    osDragTargetFolderId,
    handlers: osDragHandlers
  } = useOsFileDrop(containerRef, {
    onDrop: async (dataTransfer, targetId) => {
      if (isCurrentFolderReadOnly) return
      await uploadFromDataTransfer(dataTransfer.items, targetId ?? currentFolderId)
    }
  })

  const sortedItemsWithSelection = useMemo(
    () => sortedItems.map((i) => ({ ...i, isSelected: selectedIds.has(i.id) })),
    [sortedItems, selectedIds]
  )

  const cancelPendingRename = useCallback((): void => {
    if (renameClickTimerRef.current) {
      clearTimeout(renameClickTimerRef.current)
      renameClickTimerRef.current = null
    }
    pendingRenameItemIdRef.current = null
  }, [])

  useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  useEffect(() => {
    clearSelection()
  }, [currentFolderId, clearSelection])

  useEffect(() => {
    setSelectedSearchId(null)
  }, [searchQuery])

  useEffect(() => {
    if (!renameItemRequestId) return
    const file = fileItems.find((item) => item.id === renameItemRequestId)
    if (file) {
      setSelectedIds(new Set([renameItemRequestId]))
      if (!isCurrentFolderReadOnly) setRenamingItemId(renameItemRequestId)
    }
    onRenameItemRequestHandled?.()
  }, [
    renameItemRequestId,
    fileItems,
    setSelectedIds,
    onRenameItemRequestHandled,
    isCurrentFolderReadOnly
  ])

  useEffect(() => {
    cancelPendingRename()
    setRenamingItemId(null)
  }, [cancelPendingRename, currentFolderId, viewMode])

  useEffect(() => {
    const pendingItemId = pendingRenameItemIdRef.current
    if (pendingItemId && (!selectedIds.has(pendingItemId) || selectedIds.size !== 1)) {
      cancelPendingRename()
    }
  }, [cancelPendingRename, selectedIds])

  useEffect(() => {
    return () => cancelPendingRename()
  }, [cancelPendingRename])

  const handleEscape = useCallback((): void => {
    if (renamingItemId) {
      setRenamingItemId(null)
      return
    }
    clearSelection()
    onEscape?.()
  }, [clearSelection, onEscape, renamingItemId])

  const handleContainerContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      if ((event.target as Element).closest('[data-file-item]')) return
      event.preventDefault()
      onEmptyAreaContextMenu?.(event)
    },
    [onEmptyAreaContextMenu]
  )

  const handleItemContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      cancelPendingRename()
      if (!selectedIds.has(itemId)) setSelectedIds(new Set([itemId]))
      const item = sortedItems.find((entry) => entry.id === itemId)
      if (item?.isFolder) {
        onFolderContextMenu?.(itemId, event)
      } else {
        onItemContextMenu?.(itemId, event)
      }
    },
    [
      sortedItems,
      selectedIds,
      setSelectedIds,
      onFolderContextMenu,
      onItemContextMenu,
      cancelPendingRename
    ]
  )

  const handleItemDoubleClick = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      cancelPendingRename()
      event.stopPropagation()
      const item = sortedItems.find((entry) => entry.id === itemId)
      if (item?.isFolder) {
        void navigateToFolder(itemId)
        return
      }
      const file = fileItems.find((entry) => entry.id === itemId)
      if (file && isPresentable(file.mimeType)) {
        const presentable = getPresentableItems(sortedFileItems)
        const idx = presentable.findIndex((f) => f.id === itemId)
        if (idx !== -1) {
          useMediaProjectionStore.getState().startPresentation(presentable, idx)
        } else {
          toast.warning(t('fileExplorer.noProjectableFiles'))
        }
      }
    },
    [cancelPendingRename, sortedItems, sortedFileItems, fileItems, navigateToFolder, t]
  )

  const handleRenameSubmit = useCallback(
    (itemId: string, baseName: string): void => {
      if (isCurrentFolderReadOnly) {
        setRenamingItemId(null)
        return
      }
      const file = fileItems.find((item) => item.id === itemId)
      if (!file) {
        setRenamingItemId(null)
        return
      }

      const trimmedBase = baseName.trim()
      if (!validateDisplayName(trimmedBase)) {
        toast.danger(t('fileExplorer.invalidName', 'Invalid name'))
        return
      }

      const { extension } = splitFileName(file.name)
      const nextName = `${trimmedBase}${extension}`
      const siblingNames = fileItems
        .filter((item) => item.parentId === file.parentId)
        .map((item) => item.name)
      if (hasNameConflict(nextName, siblingNames, { excludeName: file.name })) {
        toast.danger(t('fileExplorer.fileAlreadyExists', 'A file with this name already exists'))
        return
      }

      useFileExplorerStore.getState().updateItem?.(itemId, { name: nextName })
      setRenamingItemId(null)
    },
    [fileItems, t, isCurrentFolderReadOnly]
  )

  const handleRenameCancel = useCallback((): void => {
    cancelPendingRename()
    setRenamingItemId(null)
  }, [cancelPendingRename])

  const handleItemPointerDown = useCallback(
    (itemId: string, event: React.PointerEvent): void => {
      if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        pointerRef.current = null
        cancelPendingRename()
        return
      }

      pointerRef.current = {
        itemId,
        x: event.clientX,
        y: event.clientY,
        moved: false
      }
    },
    [cancelPendingRename]
  )

  const handleItemPointerMove = useCallback(
    (itemId: string, event: React.PointerEvent): void => {
      const pointer = pointerRef.current
      if (!pointer || pointer.itemId !== itemId) return
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) {
        pointer.moved = true
        cancelPendingRename()
      }
    },
    [cancelPendingRename]
  )

  const handleViewItemClick = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      const wasAlreadySelected = selectedIds.has(itemId) && selectedIds.size === 1
      const isNameRegion = (event.target as Element).closest('[data-file-name-region]') !== null
      const pointer = pointerRef.current
      const hadPointerMovement = pointer?.itemId === itemId && pointer.moved
      handleItemClick(itemId, event)

      if (
        event.button !== 0 ||
        event.detail > 1 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        hadPointerMovement
      ) {
        cancelPendingRename()
        return
      }

      if (!wasAlreadySelected) {
        cancelPendingRename()
        return
      }

      const item = sortedItems.find((entry) => entry.id === itemId)
      if (!item || item.isFolder) return
      if (isNameRegion && !isCurrentFolderReadOnly) {
        cancelPendingRename()
        pendingRenameItemIdRef.current = itemId
        renameClickTimerRef.current = setTimeout(() => {
          setRenamingItemId(itemId)
          renameClickTimerRef.current = null
          pendingRenameItemIdRef.current = null
        }, SLOW_CLICK_RENAME_MIN_MS)
      }
    },
    [cancelPendingRename, handleItemClick, selectedIds, sortedItems, isCurrentFolderReadOnly]
  )

  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (isCurrentFolderReadOnly) return
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
        await deleteFolderFromStore(id)
      } else {
        await removeFileItemFromStore(id)
      }
    }
    clearSelection()
  }, [selectedIds, confirm, t, folderIds, clearSelection, isCurrentFolderReadOnly])

  const handleCopySelected = useCallback((): void => {
    if (selectedIds.size === 0) return
    onCopy?.(selectedIds)
  }, [selectedIds, onCopy])

  const handleCutSelected = useCallback((): void => {
    if (isCurrentFolderReadOnly) return
    if (selectedIds.size === 0) return
    onCut?.(selectedIds)
  }, [selectedIds, onCut, isCurrentFolderReadOnly])

  const handlePasteSelected = useCallback((): void => {
    if (isCurrentFolderReadOnly) return
    onPaste?.()
  }, [onPaste, isCurrentFolderReadOnly])

  useKeyboardShortcuts(
    [
      { config: SHORTCUTS.EDIT.SELECT_ALL, handler: selectAll, preventDefault: true },
      { config: SHORTCUTS.EDIT.COPY, handler: handleCopySelected, preventDefault: true },
      { config: SHORTCUTS.EDIT.CUT, handler: handleCutSelected, preventDefault: true },
      { config: SHORTCUTS.EDIT.PASTE, handler: handlePasteSelected, preventDefault: true },
      { config: SHORTCUTS.EDIT.ESCAPE, handler: handleEscape, preventDefault: true },
      {
        config: SHORTCUTS.EDIT.DELETE,
        handler: () => void handleDeleteSelected(),
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE_ALT,
        handler: () => void handleDeleteSelected(),
        preventDefault: true
      },
      {
        config: SHORTCUTS.MEDIA.START_PRESENTATION,
        handler: () => {
          const presentable = getPresentableItems(sortedFileItems)
          if (presentable.length > 0) {
            useMediaProjectionStore.getState().startPresentation(presentable, 0)
          } else {
            toast.warning(t('fileExplorer.noProjectableFiles'))
          }
        },
        preventDefault: true
      },
      {
        config: SHORTCUTS.MEDIA.START_FROM_CURRENT,
        handler: () => {
          const presentable = getPresentableItems(sortedFileItems)
          if (presentable.length === 0) {
            toast.warning(t('fileExplorer.noProjectableFiles'))
            return
          }
          const firstSelected = [...selectedIds].find((id) => presentable.some((f) => f.id === id))
          const idx = firstSelected ? presentable.findIndex((f) => f.id === firstSelected) : 0
          useMediaProjectionStore.getState().startPresentation(presentable, Math.max(0, idx))
        },
        preventDefault: true
      }
    ],
    { enabled: true, sectionKey: 'edit' }
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

  const handleDragStart = useCallback(
    (event: DragStartEvent): void => {
      if (isCurrentFolderReadOnly) return
      setRenamingItemId(null)
      cancelPendingRename()
      pointerRef.current = null
      const nextActiveId = String(event.active.id)
      setActiveId(nextActiveId)

      if (selectedIds.has(nextActiveId)) {
        setDraggedIds(new Set(selectedIds))
      } else {
        setSelectedIds(new Set([nextActiveId]))
        setDraggedIds(new Set([nextActiveId]))
      }
    },
    [cancelPendingRename, selectedIds, setSelectedIds, isCurrentFolderReadOnly]
  )

  const handleDragOver = useCallback((): void => {}, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      if (isCurrentFolderReadOnly) return
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

      const allSortedIds = sortedItems.map((item) => item.id)
      const oldIndex = allSortedIds.indexOf(String(active.id))
      const newIndex = allSortedIds.indexOf(String(over.id))
      if (oldIndex !== -1 && newIndex !== -1) {
        setCustomOrder(currentFolderId, arrayMove(allSortedIds, oldIndex, newIndex))
        setSortDir('none')
      }
    },
    [
      draggedIds,
      folderIds,
      sortedItems,
      currentFolderId,
      moveFolder,
      moveItem,
      setCustomOrder,
      setSortDir,
      isCurrentFolderReadOnly
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
      const isCut = !!clipboard && clipboard.mode === 'cut' && clipboard.itemIds.has(item.id)
      const isOsDragTarget = item.isFolder && osDragTargetFolderId === item.id
      return (
        <SortableViewItem
          item={item}
          folder={folder}
          file={file}
          isDraggedAway={draggedIds.has(item.id)}
          isMultiDrag={isMultiDrag}
          isCut={isCut}
          isOsDragTarget={isOsDragTarget}
          onPointerDown={handleItemPointerDown}
          onPointerMove={handleItemPointerMove}
        >
          {children}
        </SortableViewItem>
      )
    },
    [
      folders,
      fileItems,
      draggedIds,
      isMultiDrag,
      clipboard,
      osDragTargetFolderId,
      handleItemPointerDown,
      handleItemPointerMove
    ]
  )

  if (searchQuery.trim()) {
    const handleSearchFileClick = (result: SearchResult & { kind: 'file' }): void => {
      void navigateToFolder(result.item.parentId)
      setSearchQuery('')
    }
    const handleSearchFolderClick = (result: SearchResult & { kind: 'folder' }): void => {
      void navigateToFolder(result.folder.id)
      setSearchQuery('')
    }

    return (
      <div className="h-full overflow-auto">
        {searchResults.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <p className="text-sm text-default-400">{t('fileExplorer.search.noResults')}</p>
          </div>
        ) : (
          <SearchResultsList
            results={searchResults}
            selectedId={selectedSearchId}
            onSelectId={setSelectedSearchId}
            onFileClick={handleSearchFileClick}
            onFolderClick={handleSearchFolderClick}
          />
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full"
      onClick={handleContainerClick}
      onMouseDown={handleContainerMouseDown}
      onDragEnter={osDragHandlers.onDragEnter}
      onDragOver={osDragHandlers.onDragOver}
      onDragLeave={osDragHandlers.onDragLeave}
      onDrop={isCurrentFolderReadOnly ? undefined : osDragHandlers.onDrop}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full" onContextMenu={handleContainerContextMenu}>
          <SortableContext items={sortedItemsWithSelection.map((item) => item.id)}>
            {viewMode === 'list' ? (
              <ListView
                items={sortedItemsWithSelection}
                sortField={sortField}
                sortDir={sortDir}
                onSortChange={handleSortChange}
                colWidths={colWidths}
                onColWidthChange={(col, w) => setColWidths({ [col]: w })}
                onItemClick={handleViewItemClick}
                onItemDoubleClick={handleItemDoubleClick}
                onItemContextMenu={handleItemContextMenu}
                renamingItemId={renamingItemId}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                renderItemWrapper={renderItemWrapper}
              />
            ) : (
              <GridView
                items={sortedItemsWithSelection}
                viewMode={viewMode}
                onItemClick={handleViewItemClick}
                onItemDoubleClick={handleItemDoubleClick}
                onItemContextMenu={handleItemContextMenu}
                onItemFavoriteToggle={toggleFavorite}
                renamingItemId={renamingItemId}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                renderItemWrapper={renderItemWrapper}
              />
            )}
          </SortableContext>
        </div>
        <DragOverlay>
          {activeItem ? (
            <DragOverlayContent
              name={activeItem.name}
              count={draggedIds.size || 1}
              isFolder={activeItem.isFolder}
              mimeType={activeItem.mimeType}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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

      {isOsDragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="absolute inset-2 rounded-xl border-2 border-dashed border-primary/60 bg-accent/10" />
          <div className="relative flex flex-col items-center gap-2 text-primary/80">
            <Upload size={32} />
            <span className="text-sm font-medium">
              {osDragTargetFolderId
                ? t('fileExplorer.upload.dropToFolder', 'Drop into folder')
                : t('fileExplorer.upload.dropToUpload', 'Drop to upload')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileBrowser
