import { useState, useRef } from 'react'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleStore } from '@renderer/stores/bible'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import type { VerseItem, Folder, FolderItem } from '@shared/types/folder'
import { isVerseItem, isFolder } from '@shared/types/folder'
import { ScrollShadow, Button, Breadcrumbs, Input, Modal, TextField, Label } from '@heroui/react'
import { FolderPlus, Folder as FolderIcon, Trash2, X, BookText, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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

export function CustomFolderTab() {
  const {
    root,
    currentFolderId,
    getCurrentFolder,
    addFolder,
    deleteFolder,
    removeItem,
    navigateToFolder,
    navigateToRoot,
    moveItem,
    reorderItems
  } = useBibleFolderStore()
  const { navigateTo } = useBibleStore.getState()
  const confirm = useConfirm()
  const { t } = useTranslation()

  const [isModalOpen, setModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const folderDragCounterRef = useRef<Map<string, number>>(new Map())

  const currentFolder = getCurrentFolder()

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim())
      setNewFolderName('')
      setModalOpen(false)
    }
  }

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
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

  const handleDeleteItem = async (item: VerseItem) => {
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

  const resetDragState = () => {
    setDragState(null)
    setDropTarget(null)
    folderDragCounterRef.current.clear()
  }

  const handleDragStart = (e: React.DragEvent, itemId: string, itemType: DragItemType) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', itemId)
    setDragState({ itemId, itemType })
  }

  const handleDragEnd = () => {
    resetDragState()
  }

  const handleItemDragOver = (e: React.DragEvent, targetId: string, targetType: DragItemType) => {
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

  const handleFolderDragEnter = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const prev = folderDragCounterRef.current.get(folderId) ?? 0
    folderDragCounterRef.current.set(folderId, prev + 1)
  }

  const handleFolderDragLeave = (e: React.DragEvent, folderId: string) => {
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

  const handleListDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleListDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragState || dragState.itemType !== 'verse') return
    const folder = currentFolder
    const currentItems = folder.items
    const draggedId = dragState.itemId
    if (!currentItems.find((i) => i.id === draggedId)) return
    const newOrder = currentItems.map((i) => i.id).filter((id) => id !== draggedId)
    newOrder.push(draggedId)
    reorderItems(folder.id, newOrder)
    resetDragState()
  }

  const handleItemDrop = (e: React.DragEvent, targetId: string, targetType: DragItemType) => {
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

  const renderDropIndicator = (id: string) => (
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
  ) => {
    const isBeingDragged = dragState?.itemId === item.id
    const isLastItem = index === allItems.length - 1

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
            className={[
              'flex items-center justify-between p-2 rounded-md group cursor-pointer select-none transition-colors duration-150',
              isBeingDragged ? 'opacity-40' : '',
              isFolderDropTarget
                ? 'bg-primary/15 ring-2 ring-primary/50 ring-dashed'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
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
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-0 font-normal min-w-0"
                onPress={() => navigateToFolder(item.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderIcon className="w-5 h-5 text-neutral-500 shrink-0" />
                  <span className="font-medium truncate">{item.name}</span>
                </div>
              </Button>
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
            className={[
              'flex items-center justify-between p-2 rounded-md group select-none transition-colors duration-150',
              isBeingDragged ? 'opacity-40' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
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
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-0 font-normal min-w-0"
                onPress={() =>
                  navigateTo({
                    bookNumber: item.bookNumber,
                    chapter: item.chapter,
                    verse: item.verseStart
                  })
                }
              >
                <div className="flex items-center gap-2 text-left min-w-0">
                  <BookText className="w-5 h-5 text-neutral-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{reference}</div>
                    <div className="text-sm text-neutral-500 whitespace-normal">{item.text}</div>
                  </div>
                </div>
              </Button>
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

  const items = currentFolder
    ? [...currentFolder.folders, ...currentFolder.items]
    : [...root.folders, ...root.items]

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-2 border-b border-neutral-200 dark:border-neutral-800">
        <Breadcrumbs>
          <Breadcrumbs.Item onPress={navigateToRoot}>
            {t('bible.library', 'Bible Library')}
          </Breadcrumbs.Item>
          {currentFolder ? <Breadcrumbs.Item>{currentFolder.name}</Breadcrumbs.Item> : null}
        </Breadcrumbs>
        {!currentFolderId && (
          <Button variant="ghost" size="sm" onPress={() => setModalOpen(true)}>
            <FolderPlus className="w-5 h-5 mr-2" />
            {t('bible.new_folder', 'New Folder')}
          </Button>
        )}
      </header>

      <ScrollShadow className="flex-grow p-2">
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

      <Modal isOpen={isModalOpen} onOpenChange={setModalOpen}>
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
                <Button variant="tertiary" onPress={() => setModalOpen(false)}>
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
