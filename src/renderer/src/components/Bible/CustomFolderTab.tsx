import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
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
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import type { VerseItem, Folder, FolderItem } from '@shared/types/folder'
import { isVerseItem, isFolder } from '@shared/types/folder'
import { ScrollShadow, Button, Input, Modal, TextField, Label } from '@heroui/react'
import { FolderPlus, Folder as FolderIcon, Trash2, X, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { useFolderContextMenu } from './useFolderContextMenu'

interface CustomFolderTabProps {
  isModalOpen?: boolean
  onModalOpenChange?: (open: boolean) => void
}

function getVerseReference(item: VerseItem): string {
  if (item.verseStart === item.verseEnd) {
    return `${item.bookName} ${item.chapter}:${item.verseStart}`
  }
  return `${item.bookName} ${item.chapter}:${item.verseStart}-${item.verseEnd}`
}

type ClipboardMode = 'copy' | 'cut'

interface ClipboardState {
  items: (FolderItem | Folder)[]
  mode: ClipboardMode
}

type DndItemData = { type: 'folder'; item: Folder } | { type: 'verse'; item: VerseItem }

interface SortableItemProps {
  id: string
  data: DndItemData
  isSelected: boolean
  isFolderDropTarget: boolean
  children: (
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
    isDragging: boolean
  ) => React.ReactNode
}

function SortableItem({
  id,
  data,
  isSelected,
  isFolderDropTarget,
  children
}: SortableItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  void isSelected
  void isFolderDropTarget

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      {children(
        { ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>,
        isDragging
      )}
    </li>
  )
}

export function CustomFolderTab({
  isModalOpen = false,
  onModalOpenChange = () => {}
}: CustomFolderTabProps): React.JSX.Element {
  const {
    root,
    currentFolderId,
    getCurrentFolder,
    addFolder,
    deleteFolder,
    removeItem,
    navigateToFolder,
    moveItem,
    reorderItems,
    reorderFolders,
    addItem
  } = useBibleFolderStore()
  const { navigateTo } = useBibleStore.getState()
  const { claimProjection, project } = useProjection()
  const confirm = useConfirm()
  const { t } = useTranslation()

  const [newFolderName, setNewFolderName] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null)
  const lastClickedIdRef = useRef<string | null>(null)

  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFolderContextMenu()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  const currentFolder = getCurrentFolder()

  const items = useMemo(
    () =>
      currentFolder
        ? [...currentFolder.folders, ...currentFolder.items]
        : [...root.folders, ...root.items],
    [currentFolder, root]
  )

  const activeDragItem = useMemo(
    () => (activeDragId ? items.find((i) => i.id === activeDragId) : null),
    [activeDragId, items]
  )

  const handleItemClick = useCallback(
    (itemId: string, event: React.MouseEvent) => {
      event.stopPropagation()

      if (event.shiftKey && lastClickedIdRef.current) {
        const allIds = items.map((i) => i.id)
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
    [items]
  )

  const handleContainerClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      setSelectedItemIds(new Set())
      lastClickedIdRef.current = null
    }
  }, [])

  const handleVerseDoubleClick = useCallback(
    (item: VerseItem) => {
      navigateTo({ bookNumber: item.bookNumber, chapter: item.chapter, verse: item.verseStart })
      const { content, versions } = useBibleStore.getState()
      const versionId = versions.length > 0 ? versions[0].id : 0
      const books = content.get(versionId)
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
    setSelectedItemIds(new Set(items.map((i) => i.id)))
  }, [items])

  const handleCopy = useCallback(() => {
    if (selectedItemIds.size === 0) return
    const selected = items.filter((i) => selectedItemIds.has(i.id))
    setClipboard({ items: selected, mode: 'copy' })
  }, [selectedItemIds, items])

  const handleCut = useCallback(() => {
    if (selectedItemIds.size === 0) return
    const selected = items.filter((i) => selectedItemIds.has(i.id))
    setClipboard({ items: selected, mode: 'cut' })
  }, [selectedItemIds, items])

  const handlePaste = useCallback(() => {
    if (!clipboard) return
    const targetFolderId = currentFolderId

    for (const item of clipboard.items) {
      if (isFolder(item)) {
        addFolder(item.name)
      } else if (isVerseItem(item as FolderItem)) {
        const verseItem = item as VerseItem
        addItem({ ...verseItem, id: crypto.randomUUID(), folderId: targetFolderId }, targetFolderId)
      }
    }

    if (clipboard.mode === 'cut') {
      for (const item of clipboard.items) {
        if (isFolder(item)) {
          deleteFolder(item.id)
        } else if (isVerseItem(item as FolderItem)) {
          removeItem(item.id)
        }
      }
      setClipboard(null)
    }

    setSelectedItemIds(new Set())
  }, [clipboard, currentFolderId, addItem, addFolder, removeItem, deleteFolder])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItemIds.size === 0) return
    const selected = items.filter((i) => selectedItemIds.has(i.id))

    const confirmed = await confirm({
      title: t('bible.delete_selected_title', {
        count: selected.length,
        defaultValue: `Delete ${selected.length} item(s)?`
      }),
      description: t('bible.delete_item_description', {
        defaultValue: 'This action cannot be undone.'
      }),
      status: 'danger'
    })

    if (!confirmed) return

    for (const item of selected) {
      if (isFolder(item)) {
        deleteFolder(item.id)
      } else if (isVerseItem(item as FolderItem)) {
        removeItem(item.id)
      }
    }
    setSelectedItemIds(new Set())
    lastClickedIdRef.current = null
  }, [selectedItemIds, items, confirm, t, removeItem, deleteFolder])

  useKeyboardShortcuts(
    [
      {
        config: SHORTCUTS.EDIT.SELECT_ALL,
        handler: handleSelectAll,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.COPY,
        handler: handleCopy,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.CUT,
        handler: handleCut,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.PASTE,
        handler: handlePaste,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE,
        handler: handleDeleteSelected,
        preventDefault: true
      },
      {
        config: SHORTCUTS.EDIT.DELETE_ALT,
        handler: handleDeleteSelected,
        preventDefault: true
      }
    ],
    { enabled: true }
  )

  const handleContextMenuForItem = useCallback(
    (item: VerseItem, e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const isAlreadySelected = selectedItemIds.has(item.id)
      if (selectedItemIds.size > 1 && isAlreadySelected) {
        showMultiSelectMenu(selectedItemIds, e, handleCopy, handleCut, handleDeleteSelected)
      } else {
        if (!isAlreadySelected) {
          setSelectedItemIds(new Set([item.id]))
        }
        showItemMenu(
          item,
          isAlreadySelected,
          e,
          setSelectedItemIds,
          handleCopy,
          handleCut,
          handleDeleteSelected
        )
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

  const handleContextMenuForFolder = useCallback(
    (folder: Folder, e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const isAlreadySelected = selectedItemIds.has(folder.id)
      if (selectedItemIds.size > 1 && isAlreadySelected) {
        showMultiSelectMenu(selectedItemIds, e, handleCopy, handleCut, handleDeleteSelected)
      } else {
        if (!isAlreadySelected) {
          setSelectedItemIds(new Set([folder.id]))
        }
        showFolderMenu(
          folder,
          isAlreadySelected,
          e,
          setSelectedItemIds,
          clipboard,
          handleCopy,
          handleCut,
          handlePaste,
          handleDeleteSelected
        )
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
      handleDeleteSelected
    ]
  )

  const handleContextMenuForContainer = useCallback(
    (e: React.MouseEvent): void => {
      if (e.target !== e.currentTarget) return
      e.preventDefault()
      showEmptyAreaMenu(e, clipboard, handlePaste, () => onModalOpenChange(true))
    },
    [clipboard, showEmptyAreaMenu, handlePaste, onModalOpenChange]
  )

  const handleAddFolder = (): void => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim(), currentFolderId)
      setNewFolderName('')
      onModalOpenChange(false)
    }
  }

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

  const handleDeleteItem = async (item: VerseItem): Promise<void> => {
    const reference = getVerseReference(item)
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

  const handleDragStart = useCallback((event: DragStartEvent): void => {
    setActiveDragId(String(event.active.id))
    setFolderDropTargetId(null)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent): void => {
    const { over } = event
    if (!over) {
      setFolderDropTargetId(null)
      return
    }
    const overData = over.data.current as DndItemData | undefined
    if (overData?.type === 'folder') {
      setFolderDropTargetId(String(over.id))
    } else {
      setFolderDropTargetId(null)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      setActiveDragId(null)
      setFolderDropTargetId(null)

      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeData = active.data.current as DndItemData | undefined
      const overData = over.data.current as DndItemData | undefined

      if (!activeData) return

      const parentFolder = currentFolder
      const parentFolderId = parentFolder?.id ?? root.id

      if (activeData.type === 'verse' && overData?.type === 'folder') {
        moveItem(String(active.id), String(over.id))
        return
      }

      if (activeData.type === 'folder' && overData?.type === 'folder') {
        const folderIds = (parentFolder ?? root).folders.map((f) => f.id)
        const oldIndex = folderIds.indexOf(String(active.id))
        const newIndex = folderIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderFolders(parentFolderId, arrayMove(folderIds, oldIndex, newIndex))
        }
        return
      }

      if (activeData.type === 'verse' && overData?.type === 'verse') {
        const verseIds = (parentFolder ?? root).items.map((i) => i.id)
        const oldIndex = verseIds.indexOf(String(active.id))
        const newIndex = verseIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderItems(parentFolderId, arrayMove(verseIds, oldIndex, newIndex))
        }
        return
      }

      if (activeData.type === 'folder' && overData?.type === 'verse') {
        const allIds = items.map((i) => i.id)
        const folderIds = (parentFolder ?? root).folders.map((f) => f.id)
        const oldIndex = allIds.indexOf(String(active.id))
        const newIndex = allIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(
            folderIds,
            folderIds.indexOf(String(active.id)),
            Math.min(newIndex, folderIds.length - 1)
          )
          reorderFolders(parentFolderId, reordered)
        }
        return
      }

      if (activeData.type === 'verse' && overData?.type === 'verse') {
        const verseIds = (parentFolder ?? root).items.map((i) => i.id)
        const oldIndex = verseIds.indexOf(String(active.id))
        const newIndex = verseIds.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderItems(parentFolderId, arrayMove(verseIds, oldIndex, newIndex))
        }
      }
    },
    [currentFolder, root, items, moveItem, reorderItems, reorderFolders]
  )

  const renderFolderContent = (
    item: Folder,
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
    isItemSelected: boolean,
    isDragging: boolean
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
          'flex items-center justify-between rounded-3xl p-3 group cursor-pointer select-none transition-colors',
          isDragging ? 'opacity-40' : '',
          isItemSelected
            ? 'bg-accent-soft-hover'
            : isFolderDropTarget
              ? 'bg-accent/15 ring-2 ring-accent/50 ring-dashed'
              : 'hover:bg-accent/8'
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0 w-full">
          <button
            type="button"
            aria-label={t('common.drag_handle', 'Drag to reorder')}
            tabIndex={-1}
            className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0 touch-none p-0 border-0 bg-transparent"
            onMouseDown={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <FolderIcon className="w-4 h-4 text-muted shrink-0" />
          <span className="font-medium truncate flex-1">{item.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 shrink-0"
          onPress={() => handleDeleteFolder(item.id, item.name)}
          aria-label={t('bible.delete_folder_title', {
            name: item.name,
            defaultValue: `Delete ${item.name}`
          })}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  const renderVerseContent = (
    item: VerseItem,
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
    isItemSelected: boolean,
    isDragging: boolean
  ): React.JSX.Element => {
    const reference = getVerseReference(item)

    return (
      <div
        role="option"
        tabIndex={-1}
        aria-selected={isItemSelected}
        onClick={(e) => handleItemClick(item.id, e)}
        onDoubleClick={() => handleVerseDoubleClick(item)}
        onContextMenu={(e) => handleContextMenuForItem(item, e)}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') &&
          handleItemClick(item.id, e as unknown as React.MouseEvent)
        }
        className={[
          'flex items-center justify-between rounded-3xl p-3 group select-none transition-colors cursor-pointer',
          isDragging ? 'opacity-40' : '',
          isItemSelected ? 'bg-accent-soft-hover' : 'hover:bg-accent/8'
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center gap-1 w-full min-w-0">
          <button
            type="button"
            aria-label={t('common.drag_handle', 'Drag to reorder')}
            tabIndex={-1}
            className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0 touch-none p-0 border-0 bg-transparent"
            onMouseDown={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-left min-w-0 w-full">
            <div className="min-w-0">
              <div className="text-sm font-medium text-muted">{reference}</div>
              <div className="text-lg whitespace-normal">{item.text}</div>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 shrink-0"
          onPress={() => handleDeleteItem(item)}
          aria-label={t('bible.delete_item_title', {
            reference,
            defaultValue: `Delete ${reference}`
          })}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  const sortableIds = items.map((i) => i.id)

  return (
    <div className="flex flex-col h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ScrollShadow
            className="grow p-2"
            onClick={handleContainerClick}
            onContextMenu={handleContextMenuForContainer}
          >
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-neutral-500">
                {t('bible.folder_empty', 'Folder is empty')}
              </div>
            ) : (
              <ul className="list-none p-0 m-0">
                {items.map((item) => {
                  const isItemSelected = selectedItemIds.has(item.id)

                  if (isFolder(item)) {
                    return (
                      <SortableItem
                        key={item.id}
                        id={item.id}
                        data={{ type: 'folder', item }}
                        isSelected={isItemSelected}
                        isFolderDropTarget={folderDropTargetId === item.id}
                      >
                        {(dragHandleProps, isDragging) =>
                          renderFolderContent(item, dragHandleProps, isItemSelected, isDragging)
                        }
                      </SortableItem>
                    )
                  }

                  if (isVerseItem(item)) {
                    return (
                      <SortableItem
                        key={item.id}
                        id={item.id}
                        data={{ type: 'verse', item }}
                        isSelected={isItemSelected}
                        isFolderDropTarget={false}
                      >
                        {(dragHandleProps, isDragging) =>
                          renderVerseContent(item, dragHandleProps, isItemSelected, isDragging)
                        }
                      </SortableItem>
                    )
                  }

                  return null
                })}
              </ul>
            )}
          </ScrollShadow>
        </SortableContext>

        <DragOverlay>
          {activeDragItem ? (
            <div className="rounded-3xl bg-overlay shadow-lg p-3 opacity-90 text-sm">
              {isFolder(activeDragItem)
                ? activeDragItem.name
                : isVerseItem(activeDragItem)
                  ? getVerseReference(activeDragItem as VerseItem)
                  : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal isOpen={isModalOpen} onOpenChange={onModalOpenChange}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('bible.create_new_folder', 'Create New Folder')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextField
                  autoFocus
                  value={newFolderName}
                  onChange={setNewFolderName}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                >
                  <Label>{t('bible.folder_name', 'Folder Name')}</Label>
                  <Input />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => onModalOpenChange(false)}>
                  <X className="w-4 h-4 mr-2" />
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button onPress={handleAddFolder}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  {t('common.create', 'Create')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
