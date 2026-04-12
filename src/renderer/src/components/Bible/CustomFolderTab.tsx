import { useState } from 'react'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleStore } from '@renderer/stores/bible'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import type { VerseItem, Folder, FolderItem } from '@shared/types/folder'
import { isVerseItem, isFolder } from '@shared/types/folder'
import { ScrollShadow, Button, Breadcrumbs, Input, Modal, TextField, Label } from '@heroui/react'
import { FolderPlus, Folder as FolderIcon, Trash2, X, BookText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function getVerseReference(item: VerseItem): string {
  if (item.verseStart === item.verseEnd) {
    return `${item.bookName} ${item.chapter}:${item.verseStart}`
  }
  return `${item.bookName} ${item.chapter}:${item.verseStart}-${item.verseEnd}`
}

export function CustomFolderTab() {
  const {
    root,
    currentFolderId,
    getCurrentFolder,
    addFolder,
    deleteFolder,
    removeItem,
    navigateToFolder,
    navigateToRoot
  } = useBibleFolderStore()
  const { navigateTo } = useBibleStore.getState()
  const confirm = useConfirm()
  const { t } = useTranslation()

  const [isModalOpen, setModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

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

  const renderItem = (item: FolderItem | Folder) => {
    if (isFolder(item)) {
      return (
        <div
          key={item.id}
          className="flex items-center justify-between p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
        >
          <Button
            variant="ghost"
            className="w-full justify-start h-auto p-0 font-normal"
            onPress={() => navigateToFolder(item.id)}
          >
            <div className="flex items-center gap-3">
              <FolderIcon className="w-5 h-5 text-neutral-500" />
              <span className="font-medium">{item.name}</span>
            </div>
          </Button>
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

    if (isVerseItem(item)) {
      const reference = getVerseReference(item)
      return (
        <div
          key={item.id}
          className="flex items-center justify-between p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
        >
          <Button
            variant="ghost"
            className="w-full justify-start h-auto p-0 font-normal"
            onPress={() =>
              navigateTo({
                bookNumber: item.bookNumber,
                chapter: item.chapter,
                verse: item.verseStart
              })
            }
          >
            <div className="flex items-center gap-3 text-left">
              <BookText className="w-5 h-5 text-neutral-500 shrink-0" />
              <div>
                <div className="font-medium">{reference}</div>
                <div className="text-sm text-neutral-500 whitespace-normal">{item.text}</div>
              </div>
            </div>
          </Button>
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

    return null
  }

  const items = currentFolder ? [...currentFolder.folders, ...currentFolder.items] : root.folders

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-2 border-b border-neutral-200 dark:border-neutral-800">
        <Breadcrumbs>
          <Breadcrumbs.Item onPress={navigateToRoot}>
            {t('bible.library', 'Bible Library')}
          </Breadcrumbs.Item>
          {currentFolder && <Breadcrumbs.Item>{currentFolder.name}</Breadcrumbs.Item>}
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
          <div className="space-y-1">{items.map(renderItem)}</div>
        )}
      </ScrollShadow>

      <Modal isOpen={isModalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('bible.create__new_folder', 'Create New Folder')}</Modal.Heading>
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
