import React, { useState, useRef, useCallback, useMemo } from 'react'
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

type DragItemType = 'verse' | 'folder'

interface DragState {
  itemId: string
  itemType: DragItemType
}

type DropTarget = { type: 'before'; id: string } | { type: 'folder'; id: string }

type ClipboardMode = 'copy' | 'cut'

interface ClipboardState {
  items: (FolderItem | Folder)[]
  mode: ClipboardMode
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
    addItem
  } = useBibleFolderStore()
  const { navigateTo } = useBibleStore.getState()
  const { claimProjection, project } = useProjection()
  const confirm = useConfirm()
  const { t } = useTranslation()

  const [newFolderName, setNewFolderName] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const folderDragCounterRef = useRef<Map<string, number>>(new Map())
  const lastClickedIdRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFolderContextMenu()

  const currentFolder = getCurrentFolder()

  const items = useMemo(
    () =>
      currentFolder
        ? [...currentFolder.folders, ...currentFolder.items]
        : [...root.folders, ...root.items],
    [currentFolder, root]
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

  const resetDragState = (): void => {
    setDragState(null)
    setDropTarget(null)
    folderDragCounterRef.current.clear()
  }

  const handleDragStart = (e: React.DragEvent, itemId: string, itemType: DragItemType): void => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', itemId)
    setDragState({ itemId, itemType })
  }

  const handleDragEnd = (): void => {
    resetDragState()
  }

  const handleItemDragOver = (
    e: React.DragEvent,
    targetId: string,
    targetType: DragItemType
  ): void => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragState || dragState.itemId === targetId) {
      setDropTarget(null)
      return
    }

    if (targetType === 'folder' && dragState.itemType === 'verse') {
      e.dataTransfer.dropEffect = 'move'
      setDropTarget({ type: 'folder', id: targetId })
      return
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const isUpperHalf = e.clientY < rect.top + rect.height / 2
    const indicatorId = isUpperHalf ? targetId : targetId + '__after'
    setDropTarget({ type: 'before', id: indicatorId })
    e.dataTransfer.dropEffect = 'move'
  }

  const handleFolderDragEnter = (e: React.DragEvent, folderId: string): void => {
    e.preventDefault()
    e.stopPropagation()
    const prev = folderDragCounterRef.current.get(folderId) ?? 0
    folderDragCounterRef.current.set(folderId, prev + 1)
  }

  const handleFolderDragLeave = (e: React.DragEvent, folderId: string): void => {
    e.stopPropagation()
    const prev = folderDragCounterRef.current.get(folderId) ?? 0
    const next = prev - 1
    folderDragCounterRef.current.set(folderId, next)
    if (next <= 0) {
      folderDragCounterRef.current.delete(folderId)
      if (dropTarget?.type === 'folder' && dropTarget.id === folderId) {
        setDropTarget(null)
      }
    }
  }

  const handleListDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleListDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    if (!dragState || dragState.itemType !== 'verse') return
    const folder = currentFolder
    if (!folder) return
    const currentItems = folder.items
    const draggedId = dragState.itemId
    if (!currentItems.find((i) => i.id === draggedId)) return
    const newOrder = currentItems.map((i) => i.id).filter((id) => id !== draggedId)
    newOrder.push(draggedId)
    reorderItems(folder.id, newOrder)
    resetDragState()
  }

  const handleItemDrop = (e: React.DragEvent, targetId: string, targetType: DragItemType): void => {
    e.preventDefault()
    e.stopPropagation()

    if (!dragState) return

    if (targetType === 'folder' && dragState.itemType === 'verse') {
      moveItem(dragState.itemId, targetId)
      resetDragState()
      return
    }

    if (dragState.itemType !== 'verse') {
      resetDragState()
      return
    }

    const folder = currentFolder
    if (!folder) {
      resetDragState()
      return
    }
    const currentItems = folder.items
    const draggedId = dragState.itemId

    const orderedIds = currentItems.map((i) => i.id)
    const draggedIndex = orderedIds.indexOf(draggedId)

    if (draggedIndex === -1) {
      resetDragState()
      return
    }

    const isAfter = targetId.endsWith('__after')
    const cleanTargetId = isAfter ? targetId.replace('__after', '') : targetId
    const targetIndex = orderedIds.indexOf(cleanTargetId)

    if (targetIndex !== -1) {
      const newOrder = orderedIds.filter((id) => id !== draggedId)
      const insertAt = isAfter ? targetIndex + 1 : targetIndex
      const adjustedInsert = draggedIndex < targetIndex ? Math.max(0, insertAt - 1) : insertAt
      newOrder.splice(adjustedInsert, 0, draggedId)
      reorderItems(folder.id, newOrder)
    }

    resetDragState()
  }

  const dropBeforeId: string | null = dropTarget?.type === 'before' ? dropTarget.id : null

  const renderDropIndicator = (id: string): React.JSX.Element => (
    <div
      className={`h-0.5 mx-2 rounded-full transition-all duration-150 ${
        dropBeforeId === id ? 'bg-primary opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    />
  )

  const renderItem = (
    item: FolderItem | Folder,
    index: number,
    allItems: (FolderItem | Folder)[]
  ): React.JSX.Element | null => {
    const isBeingDragged = dragState?.itemId === item.id
    const isLastItem = index === allItems.length - 1
    const isItemSelected = selectedItemIds.has(item.id)

    if (isFolder(item)) {
      const isFolderDropTarget = dropTarget?.type === 'folder' && dropTarget.id === item.id

      return (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id, 'folder')}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleItemDragOver(e, item.id, 'folder')}
          onDragEnter={(e) => handleFolderDragEnter(e, item.id)}
          onDragLeave={(e) => handleFolderDragLeave(e, item.id)}
          onDrop={(e) => handleItemDrop(e, item.id, 'folder')}
          className="list-none"
        >
          {renderDropIndicator(item.id)}
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
              isBeingDragged ? 'opacity-40' : '',
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
          {isLastItem ? renderDropIndicator(item.id + '__after') : null}
        </li>
      )
    }

    if (isVerseItem(item)) {
      const reference = getVerseReference(item)

      return (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id, 'verse')}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleItemDragOver(e, item.id, 'verse')}
          onDrop={(e) => handleItemDrop(e, item.id, 'verse')}
          className="list-none"
        >
          {renderDropIndicator(item.id)}
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
              isBeingDragged ? 'opacity-40' : '',
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
          {isLastItem ? renderDropIndicator(item.id + '__after') : null}
        </li>
      )
    }

    return null
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
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
          <ul className="list-none p-0 m-0" onDragOver={handleListDragOver} onDrop={handleListDrop}>
            {items.map((item, index) => renderItem(item, index, items))}
          </ul>
        )}
      </ScrollShadow>

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
