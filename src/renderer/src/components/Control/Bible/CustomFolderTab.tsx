import React, { useState, useRef, useCallback, useMemo } from 'react'
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
import { formatVerseReferenceShort } from '@renderer/lib/bible-utils'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import type { VerseItem, Folder, FolderItem } from '@shared/types/folder'
import { isVerseItem, isFolder } from '@shared/types/folder'
import { ScrollShadow, Button, Input, Modal, TextField, Label } from '@heroui/react'
import { Folder as FolderIcon, Trash2, GripVertical } from 'lucide-react'
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

function getVerseReference(item: VerseItem, t: TFunction): string {
  return formatVerseReferenceShort(t, item.bookNumber, item.chapter, item.verseStart, item.verseEnd)
}

type ClipboardMode = 'copy' | 'cut'

interface ClipboardState {
  items: (FolderItem | Folder)[]
  mode: ClipboardMode
}

type DndItemData =
  | { type: 'folder'; item: Folder }
  | { type: 'verse'; item: VerseItem }
  | { type: 'folder-dropzone'; folderId: string }

interface SortableFolderItemProps {
  id: string
  folder: Folder
  isSelected: boolean
  isFolderDropTarget: boolean
  isCut: boolean
  children: (
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
    isDragging: boolean
  ) => React.ReactNode
}

function SortableFolderItem({
  id,
  folder,
  isCut,
  children
}: SortableFolderItemProps): React.JSX.Element {
  const sortable = useSortable({ id, data: { type: 'folder', item: folder } as DndItemData })
  const droppable = useDroppable({
    id: `drop-${id}`,
    data: { type: 'folder-dropzone', folderId: id } as DndItemData
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
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : isCut ? 0.4 : 1
  }

  return (
    <li ref={setRef} style={style} className="list-none">
      {children(
        {
          ...sortable.attributes,
          ...sortable.listeners
        } as React.HTMLAttributes<HTMLButtonElement>,
        sortable.isDragging
      )}
    </li>
  )
}

interface SortableVerseItemProps {
  id: string
  verse: VerseItem
  isSelected: boolean
  isCut: boolean
  children: (
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>,
    isDragging: boolean
  ) => React.ReactNode
}

function SortableVerseItem({
  id,
  verse,
  isCut,
  children
}: SortableVerseItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'verse', item: verse } as DndItemData
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : isCut ? 0.4 : 1
  }

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

  const folders = useMemo(
    () => (currentFolder ? currentFolder.folders : root.folders),
    [currentFolder, root]
  )

  const verses = useMemo(
    () => (currentFolder ? currentFolder.items : root.items),
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
      description: t('bible.delete_item_description'),
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

  const handleContextMenuForFolder = useCallback(
    (folder: Folder<VerseItem>, e: React.MouseEvent): void => {
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
          onDelete: handleDeleteSelected
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
      handleDeleteSelected
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
    const reference = getVerseReference(item, t)
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
    if (overData?.type === 'folder-dropzone') {
      setFolderDropTargetId(overData.folderId)
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

      if (overData?.type === 'folder-dropzone') {
        moveItem(String(active.id), overData.folderId)
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
    },
    [currentFolder, root, moveItem, reorderItems, reorderFolders]
  )

  const renderFolderContent = (
    item: Folder<VerseItem>,
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
              ? 'bg-accent-soft ring-2 ring-accent/50 ring-dashed'
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
    const reference = getVerseReference(item, t)

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
              <div className="truncate text-muted">{reference}</div>
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
    <div className="flex flex-col h-full">
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
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-neutral-500">
              {t('bible.folder_empty', 'Folder is empty')}
            </div>
          ) : (
            <ul className="list-none p-0 m-0">
              <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
                {folders.map((item) => {
                  const isItemSelected = selectedItemIds.has(item.id)
                  const isItemCut =
                    clipboard?.mode === 'cut' && clipboard.items.some((i) => i.id === item.id)
                  return (
                    <SortableFolderItem
                      key={item.id}
                      id={item.id}
                      folder={item}
                      isSelected={isItemSelected}
                      isFolderDropTarget={folderDropTargetId === item.id}
                      isCut={isItemCut}
                    >
                      {(dragHandleProps, isDragging) =>
                        renderFolderContent(item, dragHandleProps, isItemSelected, isDragging)
                      }
                    </SortableFolderItem>
                  )
                })}
              </SortableContext>

              <SortableContext items={verseIds} strategy={verticalListSortingStrategy}>
                {verses.map((item) => {
                  const isItemSelected = selectedItemIds.has(item.id)
                  const isItemCut =
                    clipboard?.mode === 'cut' && clipboard.items.some((i) => i.id === item.id)
                  return (
                    <SortableVerseItem
                      key={item.id}
                      id={item.id}
                      verse={item}
                      isSelected={isItemSelected}
                      isCut={isItemCut}
                    >
                      {(dragHandleProps, isDragging) =>
                        renderVerseContent(item, dragHandleProps, isItemSelected, isDragging)
                      }
                    </SortableVerseItem>
                  )
                })}
              </SortableContext>
            </ul>
          )}
        </ScrollShadow>

        <DragOverlay>
          {activeDragItem ? (
            <div className="rounded-3xl bg-overlay shadow-lg p-3 opacity-90 text-sm">
              {isFolder(activeDragItem)
                ? activeDragItem.name
                : isVerseItem(activeDragItem)
                  ? getVerseReference(activeDragItem as VerseItem, t)
                  : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal>
        <Modal.Backdrop isOpen={isModalOpen} onOpenChange={onModalOpenChange} isDismissable>
          <Modal.Container size="sm">
            <Modal.Dialog className="p-3 pl-5 pt-5">
              <Modal.Header>
                <Modal.Heading>
                  {t('bible.custom.createNewFolder', 'Create New Folder')}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <ShortcutScope name="overlay">
                  <TextField
                    autoFocus
                    value={newFolderName}
                    onChange={setNewFolderName}
                    className="w-full p-1"
                    onKeyDown={(e) =>
                      e.key === 'Enter' && !e.nativeEvent.isComposing && handleAddFolder()
                    }
                  >
                    <Label>{t('bible.custom.folderName', 'Folder Name')}</Label>
                    <Input variant="secondary" />
                  </TextField>
                </ShortcutScope>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => onModalOpenChange(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button variant="primary" onPress={handleAddFolder}>
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
