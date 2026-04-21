import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type Modifier
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleStore } from '@renderer/stores/bible'
import { formatVerseReferenceShort } from '@renderer/lib/bible-utils'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import type {
  VerseItemRecord,
  FolderRecord,
  AnyItemRecord,
  FolderDuration
} from '@shared/types/folder'
import { isVerseItem, isFolderRecord, computeExpiresAt, inferDuration } from '@shared/types/folder'
import { useChildFolders, useItems } from '@renderer/stores/selectors/folder'
import {
  ScrollShadow,
  Button,
  Input,
  Modal,
  TextField,
  Label,
  Select,
  ListBox
} from '@heroui/react'
import { Folder as FolderIcon, X, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'
import { useFolderContextMenu } from './useFolderContextMenu'

interface CustomFolderTabProps {
  isModalOpen?: boolean
  onModalOpenChange?: (open: boolean) => void
}

function getVerseReference(item: VerseItemRecord, t: TFunction): string {
  return formatVerseReferenceShort(t, item.bookNumber, item.chapter, item.verseStart, item.verseEnd)
}

type ClipboardMode = 'copy' | 'cut'

interface ClipboardState {
  itemIds: Set<string>
  mode: ClipboardMode
}

const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (activatorEvent && draggingNodeRect) {
    return {
      ...transform,
      x:
        transform.x +
        (activatorEvent as PointerEvent).clientX -
        draggingNodeRect.left -
        draggingNodeRect.width / 2,
      y:
        transform.y +
        (activatorEvent as PointerEvent).clientY -
        draggingNodeRect.top -
        draggingNodeRect.height / 2
    }
  }
  return transform
}

type DndItemData =
  | { type: 'folder'; item: FolderRecord }
  | { type: 'verse'; item: AnyItemRecord }
  | { type: 'folder-dropzone'; folderId: string }

interface SortableFolderItemProps {
  id: string
  folder: FolderRecord
  isSelected: boolean
  isFolderDropTarget: boolean
  isCut: boolean
  isDraggedAway: boolean
  isMultiDrag: boolean
  children: (isDragging: boolean) => React.ReactNode
}

function SortableFolderItem({
  id,
  folder,
  isCut,
  isDraggedAway,
  isMultiDrag,
  children
}: SortableFolderItemProps): React.JSX.Element {
  const sortable = useSortable({ id, data: { type: 'folder', item: folder } as DndItemData })
  const droppable = useDroppable({
    id: `drop-${id}`,
    data: { type: 'folder-dropzone', folderId: id } as DndItemData,
    disabled: isDraggedAway
  })

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      sortable.setNodeRef(el)
      droppable.setNodeRef(el)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortable.setNodeRef, droppable.setNodeRef]
  )

  const style: React.CSSProperties = {
    transform: isMultiDrag ? undefined : CSS.Transform.toString(sortable.transform),
    transition: isMultiDrag ? undefined : sortable.transition,
    opacity: sortable.isDragging ? 0.4 : isDraggedAway ? 0.4 : isCut ? 0.4 : 1
  }

  return (
    <li
      ref={setRef}
      style={style}
      className="list-none touch-none"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      {children(sortable.isDragging)}
    </li>
  )
}

interface SortableVerseItemProps {
  id: string
  verse: AnyItemRecord
  isSelected: boolean
  isCut: boolean
  isDraggedAway: boolean
  isMultiDrag: boolean
  children: (isDragging: boolean) => React.ReactNode
}

function SortableVerseItem({
  id,
  verse,
  isCut,
  isDraggedAway,
  isMultiDrag,
  children
}: SortableVerseItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'verse', item: verse } as DndItemData
  })

  const style: React.CSSProperties = {
    transform: isMultiDrag ? undefined : CSS.Transform.toString(transform),
    transition: isMultiDrag ? undefined : transition,
    opacity: isDragging ? 0.4 : isDraggedAway ? 0.4 : isCut ? 0.4 : 1
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="list-none touch-none"
      {...attributes}
      {...listeners}
    >
      {children(isDragging)}
    </li>
  )
}

export function CustomFolderTab({
  isModalOpen = false,
  onModalOpenChange = () => {}
}: CustomFolderTabProps): React.JSX.Element {
  const {
    currentFolderId,
    addFolder,
    deleteFolder,
    removeItem,
    navigateToFolder,
    moveItem,
    moveFolder,
    reorderItems,
    reorderFolders,
    addItem,
    updateFolder
  } = useBibleFolderStore()
  const { navigateTo } = useBibleStore.getState()
  const { claimProjection, project } = useProjection()
  const confirm = useConfirm()
  const { t } = useTranslation()

  const [newFolderName, setNewFolderName] = useState('')
  const [folderDuration, setFolderDuration] = useState<FolderDuration>('1day')
  const [editingFolder, setEditingFolder] = useState<FolderRecord | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null)
  const lastClickedIdRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFolderContextMenu()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  const folders = useChildFolders(currentFolderId)
  const verses = useItems(currentFolderId)

  const allItems = useMemo(() => [...folders, ...verses], [folders, verses])

  const activeDragItem = useMemo(
    () => (activeDragId ? allItems.find((i) => i.id === activeDragId) : null),
    [activeDragId, allItems]
  )
  const isMultiDrag = draggedIds.size > 1

  const handleItemClick = useCallback(
    (itemId: string, event: React.MouseEvent) => {
      event.stopPropagation()

      if (event.shiftKey && lastClickedIdRef.current) {
        const allIds = allItems.map((i) => i.id)
        const lastIndex = allIds.indexOf(lastClickedIdRef.current)
        const currentIndex = allIds.indexOf(itemId)
        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)
          const rangeIds = allIds.slice(start, end + 1)
          setSelectedItemIds(new Set(rangeIds))
          return
        }
      }

      if (event.ctrlKey || event.metaKey) {
        setSelectedItemIds((prev) => {
          const next = new Set(prev)
          if (next.has(itemId)) {
            next.delete(itemId)
          } else {
            next.add(itemId)
          }
          return next
        })
      } else {
        setSelectedItemIds(new Set([itemId]))
      }

      lastClickedIdRef.current = itemId
    },
    [allItems]
  )

  const handleContainerClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      setSelectedItemIds(new Set())
      lastClickedIdRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent): void => {
      const container = containerRef.current
      if (!container) return
      if (container.contains(event.target as Node)) return
      setSelectedItemIds(new Set())
      lastClickedIdRef.current = null
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  const handleVerseDoubleClick = useCallback(
    (item: VerseItemRecord) => {
      navigateTo({ bookNumber: item.bookNumber, chapter: item.chapter, verse: item.verseStart })
      const { content, versions } = useBibleStore.getState()
      const versionId = versions?.length > 0 ? versions[0].id : 0
      const books = content?.get(versionId)
      const book = books?.find((b) => b.number === item.bookNumber)
      const chapter = book?.chapters.find((c) => c.number === item.chapter)
      if (!chapter) return
      claimProjection('bible', { unblank: true })
      project('bible:chapter', {
        bookNumber: item.bookNumber,
        chapter: item.chapter,
        chapterVerses: chapter.verses.map((v) => ({ number: v.number, text: v.text })),
        currentVerse: item.verseStart
      })
    },
    [navigateTo, claimProjection, project]
  )

  const handleSelectAll = useCallback(() => {
    setSelectedItemIds(new Set(allItems.map((i) => i.id)))
  }, [allItems])

  const handleCopy = useCallback(
    (targetIds?: Set<string>) => {
      const ids = targetIds ?? selectedItemIds
      if (ids.size === 0) return
      setClipboard({ itemIds: ids, mode: 'copy' })
    },
    [selectedItemIds]
  )

  const handleCut = useCallback(
    (targetIds?: Set<string>) => {
      const ids = targetIds ?? selectedItemIds
      if (ids.size === 0) return
      setClipboard({ itemIds: ids, mode: 'cut' })
    },
    [selectedItemIds]
  )

  const handleCopyKeyboard = useCallback(() => handleCopy(), [handleCopy])
  const handleCutKeyboard = useCallback(() => handleCut(), [handleCut])

  const handleEscape = useCallback(() => {
    if (clipboard?.mode === 'cut') {
      setClipboard(null)
      return
    }
    if (selectedItemIds.size > 0) {
      setSelectedItemIds(new Set())
      lastClickedIdRef.current = null
    }
  }, [clipboard, selectedItemIds])

  const handlePaste = useCallback(() => {
    if (!clipboard) return

    for (const id of clipboard.itemIds) {
      const folder = useBibleFolderStore.getState().folders[id]
      if (folder) {
        addFolder(folder.name)
      } else {
        const item = useBibleFolderStore.getState().items[id]
        if (item && isVerseItem(item)) {
          addItem({ ...item, parentId: currentFolderId, expiresAt: null })
        }
      }
    }

    if (clipboard.mode === 'cut') {
      for (const id of clipboard.itemIds) {
        const folder = useBibleFolderStore.getState().folders[id]
        if (folder) {
          deleteFolder(id)
        } else {
          removeItem(id)
        }
      }
      setClipboard(null)
    }

    setSelectedItemIds(new Set())
  }, [clipboard, currentFolderId, addItem, addFolder, removeItem, deleteFolder])

  const handleDeleteSelected = useCallback(
    async (targetIds?: Set<string>) => {
      const ids = targetIds ?? selectedItemIds
      if (ids.size === 0) return

      const confirmed = await confirm({
        title: t('bible.delete_selected_title', {
          count: ids.size,
          defaultValue: `Delete ${ids.size} item(s)?`
        }),
        description: t('bible.delete_item_description'),
        status: 'danger'
      })

      if (!confirmed) return

      for (const id of ids) {
        const folder = useBibleFolderStore.getState().folders[id]
        if (folder) {
          deleteFolder(id)
        } else {
          removeItem(id)
        }
      }
      setSelectedItemIds(new Set())
      lastClickedIdRef.current = null
    },
    [selectedItemIds, confirm, t, removeItem, deleteFolder]
  )

  const handleDeleteSelectedKeyboard = useCallback(
    () => handleDeleteSelected(),
    [handleDeleteSelected]
  )

  useKeyboardShortcuts(
    [
      {
        config: SHORTCUTS.EDIT.SELECT_ALL,
        handler: handleSelectAll,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.COPY,
        handler: handleCopyKeyboard,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.CUT,
        handler: handleCutKeyboard,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.PASTE,
        handler: handlePaste,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE,
        handler: handleDeleteSelectedKeyboard,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE_ALT,
        handler: handleDeleteSelectedKeyboard,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.ESCAPE,
        handler: handleEscape,
        preventDefault: true
      }
    ],
    { enabled: true, sectionKey: 'edit' }
  )

  const handleContextMenuForItem = useCallback(
    (item: AnyItemRecord, e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const isAlreadySelected = selectedItemIds.has(item.id)
      if (selectedItemIds.size > 1 && isAlreadySelected) {
        showMultiSelectMenu({
          selectedIds: selectedItemIds,
          event: e,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDeleteSelected
        })
      } else {
        if (!isAlreadySelected) {
          setSelectedItemIds(new Set([item.id]))
        }
        showItemMenu({
          item,
          isAlreadySelected,
          event: e,
          setSelected: setSelectedItemIds,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDeleteSelected
        })
      }
    },
    [
      selectedItemIds,
      showMultiSelectMenu,
      showItemMenu,
      handleCopy,
      handleCut,
      handleDeleteSelected
    ]
  )

  const handleOpenEditFolder = useCallback(
    (folder: FolderRecord) => {
      setEditingFolder(folder)
      setNewFolderName(folder.name)
      setFolderDuration(inferDuration(folder.expiresAt, folder.createdAt))
      onModalOpenChange(true)
    },
    [onModalOpenChange]
  )

  const handleContextMenuForFolder = useCallback(
    (folder: FolderRecord, e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const isAlreadySelected = selectedItemIds.has(folder.id)
      if (selectedItemIds.size > 1 && isAlreadySelected) {
        showMultiSelectMenu({
          selectedIds: selectedItemIds,
          event: e,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDeleteSelected
        })
      } else {
        if (!isAlreadySelected) {
          setSelectedItemIds(new Set([folder.id]))
        }
        showFolderMenu({
          folder,
          isAlreadySelected,
          event: e,
          setSelected: setSelectedItemIds,
          clipboard,
          onCopy: handleCopy,
          onCut: handleCut,
          onPaste: handlePaste,
          onDelete: handleDeleteSelected,
          onEdit: handleOpenEditFolder
        })
      }
    },
    [
      selectedItemIds,
      clipboard,
      showMultiSelectMenu,
      showFolderMenu,
      handleCopy,
      handleCut,
      handlePaste,
      handleDeleteSelected,
      handleOpenEditFolder
    ]
  )

  const handleContextMenuForContainer = useCallback(
    (e: React.MouseEvent): void => {
      if (e.target !== e.currentTarget) return
      e.preventDefault()
      showEmptyAreaMenu({
        event: e,
        clipboard,
        onPaste: handlePaste,
        onNewFolder: () => onModalOpenChange(true)
      })
    },
    [clipboard, showEmptyAreaMenu, handlePaste, onModalOpenChange]
  )

  const handleAddFolder = (): void => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim(), currentFolderId, computeExpiresAt(folderDuration))
      setNewFolderName('')
      setFolderDuration('1day')
      onModalOpenChange(false)
    }
  }

  const handleEditFolderSubmit = (): void => {
    if (!editingFolder || !newFolderName.trim()) return
    updateFolder(editingFolder.id, {
      name: newFolderName.trim(),
      expiresAt: computeExpiresAt(folderDuration)
    })
    setEditingFolder(null)
    setNewFolderName('')
    setFolderDuration('1day')
    onModalOpenChange(false)
  }

  const handleModalClose = (): void => {
    setEditingFolder(null)
    setNewFolderName('')
    setFolderDuration('1day')
    onModalOpenChange(false)
  }

  const handleModalSubmit = editingFolder ? handleEditFolderSubmit : handleAddFolder

  const handleDeleteFolder = async (folderId: string, folderName: string): Promise<void> => {
    const confirmed = await confirm({
      title: t('bible.delete_folder_title', {
        name: folderName,
        defaultValue: `Delete '${folderName}'?`
      }),
      description: t('bible.delete_folder_description', {
        defaultValue: 'This action cannot be undone. All verses inside will be lost.'
      }),
      status: 'danger'
    })
    if (confirmed) {
      deleteFolder(folderId)
    }
  }

  const handleDeleteItem = async (item: AnyItemRecord): Promise<void> => {
    const reference = isVerseItem(item) ? getVerseReference(item, t) : item.id
    const confirmed = await confirm({
      title: t('bible.delete_item_title', {
        reference,
        defaultValue: `Delete '${reference}'?`
      }),
      description: t('bible.delete_item_description', {
        defaultValue: 'This action cannot be undone.'
      }),
      status: 'danger'
    })
    if (confirmed) {
      removeItem(item.id)
    }
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent): void => {
      const activeId = String(event.active.id)
      setActiveDragId(activeId)
      setFolderDropTargetId(null)

      if (selectedItemIds.has(activeId)) {
        setDraggedIds(new Set(selectedItemIds))
      } else {
        setSelectedItemIds(new Set([activeId]))
        setDraggedIds(new Set([activeId]))
        lastClickedIdRef.current = activeId
      }
    },
    [selectedItemIds]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent): void => {
      const { over } = event
      if (!over) {
        setFolderDropTargetId(null)
        return
      }
      const overData = over.data.current as DndItemData | undefined
      if (overData?.type === 'folder-dropzone' && !draggedIds.has(overData.folderId)) {
        setFolderDropTargetId(overData.folderId)
      } else {
        setFolderDropTargetId(null)
      }
    },
    [draggedIds]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const currentDraggedIds = draggedIds
      setActiveDragId(null)
      setDraggedIds(new Set())
      setFolderDropTargetId(null)

      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeData = active.data.current as DndItemData | undefined
      const overData = over.data.current as DndItemData | undefined

      if (!activeData) return

      const isMultiDrag = currentDraggedIds.size > 1

      if (overData?.type === 'folder-dropzone') {
        const targetFolderId = overData.folderId
        if (isMultiDrag) {
          for (const id of currentDraggedIds) {
            if (id === targetFolderId) continue
            const isAFolder = !!useBibleFolderStore.getState().folders[id]
            if (isAFolder) {
              moveFolder(id, targetFolderId)
            } else {
              moveItem(id, targetFolderId)
            }
          }
        } else {
          const activeId = String(active.id)
          if (activeId === targetFolderId) return
          if (activeData.type === 'folder') {
            moveFolder(activeId, targetFolderId)
          } else {
            moveItem(activeId, targetFolderId)
          }
        }
        return
      }

      if (isMultiDrag) return

      if (activeData.type === 'folder' && overData?.type === 'folder') {
        const folderIds = folders.map((f) => f.id)
        const oldIndex = folderIds.indexOf(String(active.id))
        const newIndex = folderIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderFolders(currentFolderId, arrayMove(folderIds, oldIndex, newIndex))
        }
        return
      }

      if (activeData.type === 'verse' && overData?.type === 'verse') {
        const verseIds = verses.map((i) => i.id)
        const oldIndex = verseIds.indexOf(String(active.id))
        const newIndex = verseIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderItems(currentFolderId, arrayMove(verseIds, oldIndex, newIndex))
        }
        return
      }
    },
    [
      currentFolderId,
      folders,
      verses,
      draggedIds,
      moveItem,
      moveFolder,
      reorderItems,
      reorderFolders
    ]
  )

  const renderFolderContent = (
    item: FolderRecord,
    isItemSelected: boolean,
    _isDragging: boolean
  ): React.JSX.Element => {
    const isFolderDropTarget = folderDropTargetId === item.id

    return (
      <div
        role="option"
        tabIndex={-1}
        aria-selected={isItemSelected}
        onClick={(e) => handleItemClick(item.id, e)}
        onDoubleClick={() => navigateToFolder(item.id)}
        onContextMenu={(e) => handleContextMenuForFolder(item, e)}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') &&
          handleItemClick(item.id, e as unknown as React.MouseEvent)
        }
        className={[
          'flex items-center justify-between rounded-3xl p-3 group select-none transition-colors',
          isItemSelected
            ? 'bg-accent text-accent-foreground'
            : isFolderDropTarget
              ? 'bg-accent-soft ring-2 ring-accent/50 ring-dashed'
              : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0 w-full">
          <FolderIcon
            className={`w-4 h-4 shrink-0 ${isItemSelected ? 'text-accent-foreground' : 'text-muted'}`}
          />
          <span className="font-medium truncate flex-1">{item.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer hover:bg-transparent!"
          onPress={() => handleDeleteFolder(item.id, item.name)}
          aria-label={t('bible.delete_folder_title', {
            name: item.name,
            defaultValue: `Delete ${item.name}`
          })}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  const renderVerseContent = (
    item: AnyItemRecord,
    isItemSelected: boolean,
    _isDragging: boolean
  ): React.JSX.Element => {
    const reference = isVerseItem(item) ? getVerseReference(item, t) : item.id

    return (
      <div
        role="option"
        tabIndex={-1}
        aria-selected={isItemSelected}
        onClick={(e) => handleItemClick(item.id, e)}
        onDoubleClick={() => isVerseItem(item) && handleVerseDoubleClick(item)}
        onContextMenu={(e) => handleContextMenuForItem(item, e)}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') &&
          handleItemClick(item.id, e as unknown as React.MouseEvent)
        }
        className={[
          'flex items-center justify-between rounded-3xl p-3 group select-none transition-colors',
          isItemSelected ? 'bg-accent text-accent-foreground' : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center gap-1 w-full min-w-0">
          <div className="flex items-center gap-2 text-left min-w-0 w-full">
            <div className="min-w-0">
              <div
                className={`truncate ${isItemSelected ? 'text-accent-foreground' : 'text-muted'}`}
              >
                {reference}
              </div>
              <div className="text-lg whitespace-normal">{isVerseItem(item) ? item.text : ''}</div>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer hover:bg-transparent!"
          onPress={() => handleDeleteItem(item)}
          aria-label={t('bible.delete_item_title', {
            reference,
            defaultValue: `Delete ${reference}`
          })}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const folderDropZones = args.droppableContainers.filter(
      (c) => (c.data.current as DndItemData | undefined)?.type === 'folder-dropzone'
    )
    const folderHits = pointerWithin({ ...args, droppableContainers: folderDropZones })
    if (folderHits.length > 0) return folderHits
    return closestCenter(args)
  }, [])

  const folderIds = folders.map((f) => f.id)
  const verseIds = verses.map((v) => v.id)

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ScrollShadow
          className="grow p-2"
          onClick={handleContainerClick}
          onContextMenu={handleContextMenuForContainer}
        >
          {allItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-neutral-500">
              {t('bible.folder_empty', 'Folder is empty')}
            </div>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              <SortableContext
                items={folderIds}
                strategy={isMultiDrag ? undefined : verticalListSortingStrategy}
              >
                {folders.map((item) => {
                  const isItemSelected = selectedItemIds.has(item.id)
                  const isItemCut = clipboard?.mode === 'cut' && clipboard.itemIds.has(item.id)
                  return (
                    <SortableFolderItem
                      key={item.id}
                      id={item.id}
                      folder={item}
                      isSelected={isItemSelected}
                      isFolderDropTarget={folderDropTargetId === item.id}
                      isCut={isItemCut}
                      isDraggedAway={draggedIds.has(item.id)}
                      isMultiDrag={isMultiDrag}
                    >
                      {(isDragging) => renderFolderContent(item, isItemSelected, isDragging)}
                    </SortableFolderItem>
                  )
                })}
              </SortableContext>

              <SortableContext
                items={verseIds}
                strategy={isMultiDrag ? undefined : verticalListSortingStrategy}
              >
                {verses.map((item) => {
                  const isItemSelected = selectedItemIds.has(item.id)
                  const isItemCut = clipboard?.mode === 'cut' && clipboard.itemIds.has(item.id)
                  return (
                    <SortableVerseItem
                      key={item.id}
                      id={item.id}
                      verse={item}
                      isSelected={isItemSelected}
                      isCut={isItemCut}
                      isDraggedAway={draggedIds.has(item.id)}
                      isMultiDrag={isMultiDrag}
                    >
                      {(isDragging) => renderVerseContent(item, isItemSelected, isDragging)}
                    </SortableVerseItem>
                  )
                })}
              </SortableContext>
            </ul>
          )}
        </ScrollShadow>

        <DragOverlay modifiers={[snapCenterToCursor]}>
          {activeDragItem ? (
            <div className="relative w-fit">
              {draggedIds.size >= 2 && (
                <>
                  <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-full bg-accent/60 shadow" />
                  <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-full bg-accent/80 shadow" />
                </>
              )}
              <div className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-accent text-accent-foreground shadow-lg text-sm">
                {isFolderRecord(activeDragItem) ? (
                  <>
                    <FolderIcon className="w-3.5 h-3.5" />
                    <span>{activeDragItem.name}</span>
                  </>
                ) : isVerseItem(activeDragItem) ? (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{getVerseReference(activeDragItem, t)}</span>
                  </>
                ) : null}
              </div>
              {draggedIds.size >= 2 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 flex items-center justify-center rounded-full bg-danger text-danger-foreground text-xs font-semibold px-1">
                  {draggedIds.size}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal>
        <Modal.Backdrop isOpen={isModalOpen} onOpenChange={handleModalClose} isDismissable>
          <Modal.Container size="sm">
            <Modal.Dialog className="p-3 pl-5 pt-5">
              <Modal.Header>
                <Modal.Heading>
                  {editingFolder
                    ? t('bible.custom.editFolder', 'Edit Folder')
                    : t('bible.custom.createNewFolder', 'Create New Folder')}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <ShortcutScope name="overlay">
                  <div className="flex flex-col gap-3">
                    <TextField
                      autoFocus
                      value={newFolderName}
                      onChange={setNewFolderName}
                      className="w-full p-1"
                      onKeyDown={(e) =>
                        e.key === 'Enter' && !e.nativeEvent.isComposing && handleModalSubmit()
                      }
                    >
                      <Label>{t('bible.custom.folderName', 'Folder Name')}</Label>
                      <Input variant="secondary" />
                    </TextField>
                    <div className="p-1">
                      <Label className="text-sm mb-1 block">
                        {t('bible.custom.retention', 'Retention')}
                      </Label>
                      <Select
                        value={folderDuration}
                        onChange={(v) => setFolderDuration(v as FolderDuration)}
                        aria-label={t('bible.custom.retention', 'Retention')}
                        className="w-full"
                        variant="secondary"
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {(['1day', '1week', '1month', 'permanent'] as FolderDuration[]).map(
                              (d) => (
                                <ListBox.Item
                                  key={d}
                                  id={d}
                                  textValue={t(`bible.custom.duration.${d}`)}
                                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                                >
                                  {t(`bible.custom.duration.${d}`)}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              )
                            )}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>
                </ShortcutScope>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={handleModalClose}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button variant="primary" onPress={handleModalSubmit}>
                  {t('common.confirm', 'Confirm')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
