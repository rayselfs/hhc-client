import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { useMediaFolderStore } from '@/stores/folder'
import { useFileSystem } from '@/composables/useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import type { UseFolderDialogsReturn } from './useFolderDialogs'
import type { Folder, FileItem, ClipboardItem } from '@/types/common'
import { FolderDBStore, MediaFolder } from '@/types/enum'

type MediaStore = ReturnType<typeof useMediaFolderStore>

export function useMediaOperations(
  mediaStore: MediaStore,
  dialogs: UseFolderDialogsReturn<FileItem>,
  selectedItems: { value: Set<string>; clear: () => void }, // Pass ref-like object or just the ref
  showSnackBar: (message: string, color?: string, timeout?: number, location?: string) => void,
  getUniqueName: (name: string, type: 'folder' | 'file') => string,
) {
  const { t } = useI18n()
  const fileSystem = useFileSystem()
  const db = useIndexedDB(FOLDER_DB_CONFIG)
  const {
    currentFolderPath,
    getCurrentFolders: currentFolders,
    getCurrentItems: currentItems,
    clipboard,
  } = storeToRefs(mediaStore)

  const {
    moveItem: moveItemAction,
    moveFolder: moveFolderAction,
    pasteItem,
    copyToClipboard,
    cutToClipboard,
    clearClipboard,
  } = mediaStore

  // --- Duplicate Name Logic ---
  const isDuplicateName = computed(() => {
    if (!dialogs.folderName.value.trim()) return false

    if (dialogs.editingType.value === 'file') {
      const fullName = dialogs.folderName.value.trim() + dialogs.editingExtension.value
      return currentItems.value.some((i) => {
        if (dialogs.editingFolderId.value && i.id === dialogs.editingFolderId.value) return false
        return i.name === fullName
      })
    } else {
      return currentFolders.value.some((f) => {
        if (dialogs.editingFolderId.value && f.id === dialogs.editingFolderId.value) return false
        return f.name === dialogs.folderName.value.trim()
      })
    }
  })

  const nameErrorMessage = computed(() => {
    if (isDuplicateName.value) {
      return t('fileExplorer.duplicateFolderName')
    }
    return ''
  })

  // --- Create / Update ---
  const handleSave = async () => {
    if (dialogs.folderName.value.trim() && !isDuplicateName.value) {
      let expiresAt: number | null = null
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000

      switch (dialogs.retentionPeriod.value) {
        case '1day':
          expiresAt = now + oneDay
          break
        case '1week':
          expiresAt = now + oneDay * 7
          break
        case '1month':
          expiresAt = now + oneDay * 30
          break
        case 'permanent':
          expiresAt = null
          break
      }

      if (dialogs.editingFolderId.value) {
        if (dialogs.editingType.value === 'folder') {
          mediaStore.updateFolder(dialogs.editingFolderId.value, {
            name: dialogs.folderName.value,
            expiresAt: expiresAt,
          })
        } else {
          // Update File
          const fullName = dialogs.folderName.value.trim() + dialogs.editingExtension.value
          // Derive parent ID
          const currentPath = currentFolderPath.value
          const parentId =
            currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
              ? MediaFolder.ROOT_ID
              : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

          mediaStore.updateItem(dialogs.editingFolderId.value, parentId, {
            name: fullName,
            expiresAt: expiresAt,
          })
        }
      } else {
        // Create New Folder
        mediaStore.addFolderToCurrent(dialogs.folderName.value, expiresAt)
      }

      dialogs.showFolderDialog.value = false
      dialogs.folderName.value = ''
      dialogs.editingFolderId.value = null
    }
  }

  // --- Delete ---
  /**
   * Delete physical files from storage using the file system provider
   * Collects all files recursively from folders and deletes them
   */
  const deletePhysicalFiles = async (items: (FileItem | Folder<FileItem>)[]) => {
    // Collect all files to delete (including nested files in folders)
    const filesToDelete: FileItem[] = []

    const collectFiles = (item: FileItem | Folder<FileItem>) => {
      if ('items' in item) {
        // It's a folder - recursively collect files
        item.items.forEach(collectFiles)
        item.folders.forEach(collectFiles)
      } else {
        // It's a file
        filesToDelete.push(item)
      }
    }

    items.forEach(collectFiles)

    // Delete files using the file system provider
    const { succeeded, failed } = await fileSystem.deleteFiles(filesToDelete)

    // Log any failures for debugging
    if (failed.length > 0) {
      console.warn('Some files failed to delete:', failed)
    }

    return { succeeded, failed }
  }

  const confirmDeleteAction = async () => {
    const itemsToDelete: (FileItem | Folder<FileItem>)[] = []

    if (dialogs.folderToDelete.value) {
      itemsToDelete.push(dialogs.folderToDelete.value)
    } else if (dialogs.itemToDelete.value) {
      itemsToDelete.push(dialogs.itemToDelete.value)
    } else {
      // Bulk delete
      selectedItems.value.forEach((id) => {
        const folder = currentFolders.value.find((f) => f.id === id)
        if (folder) {
          itemsToDelete.push(folder)
        } else {
          const item = currentItems.value.find((i) => i.id === id)
          if (item) {
            itemsToDelete.push(item)
          }
        }
      })
    }

    // Delete physical files first
    await deletePhysicalFiles(itemsToDelete)

    // Then remove from store
    if (dialogs.folderToDelete.value) {
      mediaStore.deleteFolder(dialogs.folderToDelete.value.id)
      selectedItems.clear()
    } else if (dialogs.itemToDelete.value) {
      mediaStore.removeItemFromCurrent(dialogs.itemToDelete.value.id)
      selectedItems.clear()
    } else {
      // Bulk delete execution
      selectedItems.value.forEach((id) => {
        const folder = currentFolders.value.find((f) => f.id === id)
        if (folder) {
          mediaStore.deleteFolder(id)
        } else {
          mediaStore.removeItemFromCurrent(id)
        }
      })
      selectedItems.clear()
    }

    dialogs.showDeleteConfirmDialog.value = false
    dialogs.folderToDelete.value = null
    dialogs.itemToDelete.value = null
  }

  // --- Clipboard ---
  const handleCopy = () => {
    if (selectedItems.value.size === 0) return

    const items: ClipboardItem<FileItem>[] = []
    const currentPath = currentFolderPath.value
    const sourceFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
        ? MediaFolder.ROOT_ID
        : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

    selectedItems.value.forEach((id) => {
      const folder = currentFolders.value.find((f) => f.id === id)
      if (folder) {
        items.push({
          type: 'folder',
          data: folder,
          action: 'copy',
          sourceFolderId,
        })
      } else {
        const item = currentItems.value.find((i) => i.id === id)
        if (item) {
          items.push({
            type: 'file',
            data: item,
            action: 'copy',
            sourceFolderId,
          })
        }
      }
    })
    copyToClipboard(items)
    selectedItems.clear()
    showSnackBar(t('fileExplorer.clipboardCopied'), 'info', 3000, 'bottom left')
  }

  const handleCut = () => {
    if (selectedItems.value.size === 0) return

    const items: ClipboardItem<FileItem>[] = []
    const currentPath = currentFolderPath.value
    const sourceFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
        ? MediaFolder.ROOT_ID
        : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

    selectedItems.value.forEach((id) => {
      const folder = currentFolders.value.find((f) => f.id === id)
      if (folder) {
        items.push({
          type: 'folder',
          data: folder,
          action: 'cut',
          sourceFolderId,
        })
      } else {
        const item = currentItems.value.find((i) => i.id === id)
        if (item) {
          items.push({
            type: 'file',
            data: item,
            action: 'cut',
            sourceFolderId,
          })
        }
      }
    })
    cutToClipboard(items)
    selectedItems.clear()
    showSnackBar(t('fileExplorer.clipboardCut'), 'info', 2000, 'bottom left')
  }

  /**
   * Duplicate a thumbnail blob in IndexedDB
   * Creates a new entry with a new UUID and returns the new thumbnailBlobId
   * @param thumbnailBlobId - The original thumbnail blob ID
   * @param newItemId - The ID of the new copied item
   * @returns The new thumbnailBlobId, or null if duplication failed
   */
  const duplicateThumbnailBlob = async (
    thumbnailBlobId: string,
    newItemId: string,
  ): Promise<string | null> => {
    try {
      const originalThumbnail = await db.get<{ id: string; blob: Blob; itemId: string }>(
        FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
        thumbnailBlobId,
      )

      if (!originalThumbnail || !originalThumbnail.blob) {
        return null
      }

      const newBlobId = uuidv4()
      await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
        id: newBlobId,
        blob: originalThumbnail.blob,
        itemId: newItemId,
      })

      return newBlobId
    } catch (error) {
      console.warn('Failed to duplicate thumbnail blob:', error)
      return null
    }
  }

  /**
   * Duplicate physical files using the file system provider
   * For folders, recursively duplicates all contained files
   */
  const duplicatePhysicalFiles = async (
    item: FileItem | Folder<FileItem>,
  ): Promise<FileItem | Folder<FileItem> | null> => {
    if ('items' in item) {
      // It's a folder: Duplicate recursively
      const newItems: FileItem[] = []
      const newFolders: Folder<FileItem>[] = []

      for (const subItem of item.items) {
        const duplicatedSubItem = await duplicatePhysicalFiles(subItem)
        if (duplicatedSubItem) newItems.push(duplicatedSubItem as FileItem)
      }

      for (const subFolder of item.folders) {
        const duplicatedSubFolder = await duplicatePhysicalFiles(subFolder)
        if (duplicatedSubFolder) newFolders.push(duplicatedSubFolder as Folder<FileItem>)
      }

      return {
        ...item,
        items: newItems,
        folders: newFolders,
      }
    } else {
      // It's a file: Physical Copy using file system provider
      const fileItem = item as FileItem

      // Check if file can be copied (has permissions)
      if (!fileSystem.canEdit(fileItem)) {
        // Read-only file, just return a shallow clone
        return { ...fileItem }
      }

      // Use the file system provider to copy
      const result = await fileSystem.copyFile(fileItem)

      if (result.success && result.data) {
        const newItemId = uuidv4()
        const newMetadata = {
          ...fileItem.metadata,
          thumbnailUrl: fileItem.metadata.thumbnailUrl,
        }

        // Duplicate the thumbnail blob in IndexedDB if it exists
        if (fileItem.metadata.thumbnailBlobId) {
          const newBlobId = await duplicateThumbnailBlob(
            fileItem.metadata.thumbnailBlobId,
            newItemId,
          )
          if (newBlobId) {
            newMetadata.thumbnailBlobId = newBlobId
          }
        }

        return {
          ...fileItem,
          id: newItemId,
          url: result.data.fileUrl,
          metadata: newMetadata,
        }
      }

      // If copy failed, return a clone (the logical copy still works)
      // Still need to duplicate thumbnail if present
      console.warn('Physical file copy failed, using logical copy:', result.error)
      const newItemId = uuidv4()
      const newMetadata = { ...fileItem.metadata }

      if (fileItem.metadata.thumbnailBlobId) {
        const newBlobId = await duplicateThumbnailBlob(fileItem.metadata.thumbnailBlobId, newItemId)
        if (newBlobId) {
          newMetadata.thumbnailBlobId = newBlobId
        }
      }

      return {
        ...fileItem,
        id: newItemId,
        metadata: newMetadata,
      }
    }
  }

  const handlePaste = async () => {
    if (clipboard.value.length === 0) return

    const currentPath = currentFolderPath.value
    const targetFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
        ? MediaFolder.ROOT_ID
        : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

    for (const clipboardItem of clipboard.value) {
      if (clipboardItem.action === 'copy') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        const uniqueName = getUniqueName(clipboardItem.data.name, type)

        // Duplicate physical files using the file system provider
        // This works in both Electron and web environments
        const itemToPaste = await duplicatePhysicalFiles(clipboardItem.data)

        if (itemToPaste) {
          itemToPaste.name = uniqueName
          pasteItem(itemToPaste, targetFolderId, clipboardItem.type === 'file' ? 'file' : 'folder')
        }
      } else if (clipboardItem.action === 'cut') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'

        if (clipboardItem.sourceFolderId !== targetFolderId) {
          const uniqueName = getUniqueName(clipboardItem.data.name, type)

          if (uniqueName !== clipboardItem.data.name) {
            if (type === 'folder') {
              mediaStore.updateFolder(clipboardItem.data.id, { name: uniqueName })
            } else {
              mediaStore.updateItem(clipboardItem.data.id, clipboardItem.sourceFolderId, {
                name: uniqueName,
              })
            }
          }
        }

        if (clipboardItem.type === 'file') {
          moveItemAction(
            clipboardItem.data as FileItem,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        } else {
          moveFolderAction(
            clipboardItem.data as Folder<FileItem>,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        }
      }
    }

    if (clipboard.value.length > 0 && clipboard.value[0]?.action === 'cut') {
      clearClipboard()
    }
  }

  const handlePasteIntoFolder = async (targetFolderId: string) => {
    if (clipboard.value.length === 0) return

    for (const clipboardItem of clipboard.value) {
      if (clipboardItem.action === 'copy') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        const uniqueName = getUniqueName(clipboardItem.data.name, type)

        const itemToPaste = await duplicatePhysicalFiles(clipboardItem.data)

        if (itemToPaste) {
          itemToPaste.name = uniqueName
          pasteItem(itemToPaste, targetFolderId, clipboardItem.type === 'file' ? 'file' : 'folder')
        }
      } else if (clipboardItem.action === 'cut') {
        if (clipboardItem.type === 'file') {
          moveItemAction(
            clipboardItem.data as FileItem,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        } else {
          moveFolderAction(
            clipboardItem.data as Folder<FileItem>,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        }
      }
    }

    if (clipboard.value.length > 0 && clipboard.value[0]?.action === 'cut') {
      clearClipboard()
    }
  }

  return {
    isDuplicateName,
    nameErrorMessage,
    handleSave,
    confirmDeleteAction,
    handleCopy,
    handleCut,
    handlePaste,
    handlePasteIntoFolder,
  }
}
