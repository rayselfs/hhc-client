import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useTranslation } from 'react-i18next'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { getThumbnail } from '@renderer/lib/thumbnail-db'
import { searchAllItems } from '@renderer/lib/file-explorer-search'
import {
  deleteFolderFromStore,
  removeFileItemFromStore,
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
import type { SortField } from '@renderer/stores/file-explorer'

function compareItems(a: GridViewItem, b: GridViewItem, field: SortField, dir: 'asc' | 'desc'): number {
  const sign = dir === 'asc' ? 1 : -1
  switch (field) {
    case 'name':
      return sign * a.name.localeCompare(b.name)
    case 'createdAt':
      return sign * ((a.createdAt ?? 0) - (b.createdAt ?? 0))
    case 'size':
      return sign * ((a.size ?? 0) - (b.size ?? 0))
    case 'kind': {
      const ka = formatFileKind(a.mimeType, a.isFolder)
      const kb = formatFileKind(b.mimeType, b.isFolder)
      return sign * ka.localeCompare(kb)
    }
  }
}

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

function canHaveThumbnail(mimeType: string | undefined): boolean {
  return (
    mimeType?.startsWith('image/') === true ||
    mimeType?.startsWith('video/') === true ||
    mimeType === 'application/pdf'
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

  return (
    <div
      ref={setRef}
      style={style}
      data-file-item
      data-item-id={item.id}
      {...(item.isFolder ? { 'data-folder-id': item.id } : {})}
      className={`touch-none rounded-lg${isOsDragTarget ? ' ring-2 ring-inset ring-primary/50' : ''}`}
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

function SearchResultsList({
  results,
  onFileClick,
  onFolderClick
}: {
  results: SearchResult[]
  onFileClick: (result: SearchResult & { kind: 'file' }) => void
  onFolderClick: (result: SearchResult & { kind: 'folder' }) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col p-2">
      {results.map((result) => {
        if (result.kind === 'file') {
          return (
            <button
              key={result.item.id}
              type="button"
              onDoubleClick={() => onFileClick(result)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm cursor-pointer hover:bg-content2/60 focus:outline-none"
            >
              <div className="flex-shrink-0 w-6 flex items-center justify-center text-default-500">
                {getFileIcon(result.item.mimeType, false, 20)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm text-foreground">{result.item.name}</div>
                <div className="truncate text-xs text-default-400">{result.folderPath}</div>
              </div>
            </button>
          )
        }
        return (
          <button
            key={result.folder.id}
            type="button"
            onDoubleClick={() => onFolderClick(result)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm cursor-pointer hover:bg-content2/60 focus:outline-none"
          >
            <div className="flex-shrink-0 w-6 flex items-center justify-center">
              <Folder size={20} className="text-accent" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm text-foreground">{result.folder.name}</div>
              <div className="truncate text-xs text-default-400">{result.folderPath}</div>
            </div>
          </button>
        )
      })}
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
  onEscape
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
  const viewMode = useFileExplorerSettings((state) => state.viewMode)
  const sortField = useFileExplorerSettings((state) => state.sortField)
  const sortDir = useFileExplorerSettings((state) => state.sortDir)
  const setSortDir = useFileExplorerSettings((state) => state.setSortDir)
  const setSortFieldAndDir = useFileExplorerSettings((state) => state.setSortFieldAndDir)
  const colWidths = useFileExplorerSettings((state) => state.colWidths)
  const setColWidths = useFileExplorerSettings((state) => state.setColWidths)
  const searchQuery = useFileExplorerSearch((state) => state.searchQuery)
  const setSearchQuery = useFileExplorerSearch((state) => state.setSearchQuery)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({})
  const [rubberBandRect, setRubberBandRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [isOsDragOver, setIsOsDragOver] = useState(false)
  const [osDragTargetFolderId, setOsDragTargetFolderId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const justRubberBandedRef = useRef(false)
  const osDragTargetFolderIdRef = useRef<string | null>(null)

  React.useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  React.useEffect(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [currentFolderId])

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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return searchAllItems(searchQuery, useFileExplorerStore.getState(), t('fileExplorer.breadcrumb.root'))
  }, [searchQuery, itemsArray, foldersArray, t])

  useEffect(() => {
    let cancelled = false
    const thumbnailItems = fileItems.filter((item) => canHaveThumbnail(item.mimeType))
    const now = Date.now()
    const TWO_MINUTES = 2 * 60 * 1000

    setThumbnails((current) => {
      const next: Record<string, string | null> = {}
      for (const item of thumbnailItems) {
        if (Object.prototype.hasOwnProperty.call(current, item.id)) next[item.id] = current[item.id]
      }
      return next
    })

    async function loadThumbnails(): Promise<void> {
      for (const item of thumbnailItems) {
        if (cancelled) return
        const dataUrl = await getThumbnail(item.id)
        if (dataUrl !== null) {
          setThumbnails((prev) => ({ ...prev, [item.id]: dataUrl }))
        } else if (now - (item.createdAt ?? 0) > TWO_MINUTES) {
          setThumbnails((prev) => ({ ...prev, [item.id]: null }))
        }
      }
    }

    void loadThumbnails()

    return () => {
      cancelled = true
    }
  }, [fileItems])

  useEffect(() => {
    const onThumbnailReady = (e: Event): void => {
      const { itemId, dataUrl } = (
        e as CustomEvent<{ itemId: string; dataUrl: string | null }>
      ).detail
      setThumbnails((prev) => ({ ...prev, [itemId]: dataUrl }))
    }
    window.addEventListener('hhc:thumbnail-ready', onThumbnailReady)
    return () => window.removeEventListener('hhc:thumbnail-ready', onThumbnailReady)
  }, [])

  const allItems: GridViewItem[] = useMemo(
    () => [
      ...folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        isFolder: true,
        createdAt: folder.createdAt,
        isSelected: selectedIds.has(folder.id)
      })),
      ...fileItems.map((item) => ({
        id: item.id,
        name: item.name,
        isFolder: false,
        mimeType: item.mimeType,
        size: item.size,
        createdAt: item.createdAt,
        thumbnailUrl: canHaveThumbnail(item.mimeType) ? thumbnails[item.id] : null,
        isSelected: selectedIds.has(item.id)
      }))
    ],
    [folders, fileItems, selectedIds, thumbnails]
  )

  const sortedItems = useMemo(() => {
    const folders = allItems.filter((item) => item.isFolder)
    const files = allItems.filter((item) => !item.isFolder)
    if (sortDir !== 'none') {
      folders.sort((a, b) => compareItems(a, b, sortField, sortDir))
      files.sort((a, b) => compareItems(a, b, sortField, sortDir))
    }
    return [...folders, ...files]
  }, [allItems, sortField, sortDir])

  const allIds = useMemo(() => sortedItems.map((item) => item.id), [sortedItems])
  const folderIds = useMemo(() => sortedItems.filter((item) => item.isFolder).map((item) => item.id), [sortedItems])
  const itemIds = useMemo(() => sortedItems.filter((item) => !item.isFolder).map((item) => item.id), [sortedItems])
  const activeItem = activeId ? sortedItems.find((item) => item.id === activeId) : null
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

  const handleEscape = useCallback((): void => {
    clearSelection()
    onEscape?.()
  }, [clearSelection, onEscape])

  const handleContainerClick = useCallback(
    (event: React.MouseEvent): void => {
      if ((event.target as Element).closest('[data-file-item]')) return
      if (justRubberBandedRef.current) {
        justRubberBandedRef.current = false
        return
      }
      clearSelection()
    },
    [clearSelection]
  )

  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      if (e.button !== 0) return
      if ((e.target as Element).closest('[data-file-item]')) return

      const startX = e.clientX
      const startY = e.clientY
      let currentRect: { left: number; top: number; width: number; height: number } | null = null

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const left = Math.min(startX, moveEvent.clientX)
        const top = Math.min(startY, moveEvent.clientY)
        const width = Math.abs(moveEvent.clientX - startX)
        const height = Math.abs(moveEvent.clientY - startY)
        currentRect = { left, top, width, height }
        setRubberBandRect(currentRect)

        const container = containerRef.current
        if (!container) return
        const newSelected = new Set<string>()
        container.querySelectorAll<HTMLElement>('[data-item-id]').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (
            r.right > left &&
            r.left < left + width &&
            r.bottom > top &&
            r.top < top + height
          ) {
            const id = el.dataset.itemId
            if (id) newSelected.add(id)
          }
        })
        setSelectedIds(newSelected)
        setLastSelectedId(null)
      }

      const handleMouseUp = (): void => {
        if (currentRect && (currentRect.width > 5 || currentRect.height > 5)) {
          justRubberBandedRef.current = true
        }
        setRubberBandRect(null)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    []
  )

  const handleContainerContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      if ((event.target as Element).closest('[data-file-item]')) return
      event.preventDefault()
      onEmptyAreaContextMenu?.(event)
    },
    [onEmptyAreaContextMenu]
  )

  const handleOsDragEnter = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setIsOsDragOver(true)
  }, [])

  const handleOsDragOver = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const folderEl = (e.target as Element).closest<HTMLElement>('[data-folder-id]')
    const folderId = folderEl?.dataset.folderId ?? null
    if (folderId !== osDragTargetFolderIdRef.current) {
      osDragTargetFolderIdRef.current = folderId
      setOsDragTargetFolderId(folderId)
    }
  }, [])

  const handleOsDragLeave = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    const container = containerRef.current
    if (container && e.relatedTarget && container.contains(e.relatedTarget as Node)) return
    setIsOsDragOver(false)
    osDragTargetFolderIdRef.current = null
    setOsDragTargetFolderId(null)
  }, [])

  const handleOsDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setIsOsDragOver(false)
      const targetId = osDragTargetFolderIdRef.current ?? currentFolderId
      osDragTargetFolderIdRef.current = null
      setOsDragTargetFolderId(null)
      await uploadFromDataTransfer(e.dataTransfer.items, targetId)
    },
    [currentFolderId]
  )

  const handleItemContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (!selectedIds.has(itemId)) setSelectedIds(new Set([itemId]))
      const item = sortedItems.find((entry) => entry.id === itemId)
      if (item?.isFolder) {
        onFolderContextMenu?.(itemId, event)
      } else {
        onItemContextMenu?.(itemId, event)
      }
    },
    [sortedItems, selectedIds, onFolderContextMenu, onItemContextMenu]
  )

  const handleItemDoubleClick = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      event.stopPropagation()
      const item = sortedItems.find((entry) => entry.id === itemId)
      if (item?.isFolder) void navigateToFolder(itemId)
    },
    [sortedItems, navigateToFolder]
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
        await deleteFolderFromStore(id)
      } else {
        await removeFileItemFromStore(id)
      }
    }
    clearSelection()
  }, [selectedIds, confirm, t, folderIds, clearSelection])

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
        >
          {children}
        </SortableViewItem>
      )
    },
    [folders, fileItems, draggedIds, isMultiDrag, clipboard, osDragTargetFolderId]
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
      onDragEnter={handleOsDragEnter}
      onDragOver={handleOsDragOver}
      onDragLeave={handleOsDragLeave}
      onDrop={(e) => void handleOsDrop(e)}
    >
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
                items={sortedItems}
                sortField={sortField}
                sortDir={sortDir}
                onSortChange={handleSortChange}
                colWidths={colWidths}
                onColWidthChange={(col, w) => setColWidths({ [col]: w })}
                onItemClick={handleItemClick}
                onItemDoubleClick={handleItemDoubleClick}
                onItemContextMenu={handleItemContextMenu}
                renderItemWrapper={renderItemWrapper}
              />
            ) : (
              <GridView
                items={sortedItems}
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

      {rubberBandRect && (
        <div
          className="pointer-events-none fixed z-50 rounded-sm border border-primary/60 bg-primary/10"
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
          <div className="absolute inset-2 rounded-xl border-2 border-dashed border-primary/60 bg-primary/5" />
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
