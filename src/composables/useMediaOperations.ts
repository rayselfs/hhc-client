import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import { storeToRefs } from 'pinia'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { useMediaFolderStore } from '@/stores/folder'
import { useFileSystem } from '@/composables/useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import type { UseFolderDialogsReturn } from './useFolderDialogs'
import type { Folder, FileItem, ClipboardItem } from '@/types/common'
import { FolderDBStore, MediaFolder } from '@/types/enum'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'

type MediaStore = ReturnType<typeof useMediaFolderStore>

export type SortBy = 'name' | 'date' | 'type' | 'custom'
export type SortOrder = 'asc' | 'desc'

export function useMediaOperations(
  mediaStore: MediaStore,
  dialogs: UseFolderDialogsReturn<FileItem>,
  selectedItems: { value: Set<string>; clear: () => void }, // Pass ref-like object or just the ref
  showSnackBar: (message: string, color?: string, timeout?: number, location?: string) => void,
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

  // ==========================================
  // 1. Sorting Logic
  // ==========================================
  const sortBy = ref<SortBy>('name')
  const sortOrder = ref<SortOrder>('asc')

  const setSort = (type: SortBy) => {
    if (type === 'custom') {
      sortBy.value = 'custom'
      return
    }

    if (sortBy.value === type) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = type
      sortOrder.value = 'asc'
    }
  }

  const sortedFolders = computed(() => {
    if (sortBy.value === 'custom') return currentFolders.value
    return [...currentFolders.value].sort((a, b) => {
      if (sortBy.value === 'date') {
        const timeA = a.timestamp || 0
        const timeB = b.timestamp || 0
        return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA
      }
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
  })

  const sortedItems = computed(() => {
    if (sortBy.value === 'custom') return currentItems.value
    return [...currentItems.value].sort((a, b) => {
      if (sortBy.value === 'date') {
        const timeA = a.timestamp || 0
        const timeB = b.timestamp || 0
        return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA
      }
      if (sortBy.value === 'type') {
        const typeA = a.metadata?.fileType || ''
        const typeB = b.metadata?.fileType || ''
        const typeCompare = typeA.localeCompare(typeB)
        if (typeCompare !== 0) {
          return sortOrder.value === 'asc' ? typeCompare : -typeCompare
        }
        return a.name.localeCompare(b.name)
      }
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
  })

  // Unified list for display
  const sortedUnifiedItems = computed(() => {
    if (sortBy.value === 'type') {
      const allItems = [...currentFolders.value, ...currentItems.value]
      return allItems.sort((a, b) => {
        const typeA = 'items' in a ? 'folder' : (a as FileItem).metadata?.fileType || 'unknown'
        const typeB = 'items' in b ? 'folder' : (b as FileItem).metadata?.fileType || 'unknown'

        const typeCompare = typeA.localeCompare(typeB)
        if (typeCompare !== 0) {
          return sortOrder.value === 'asc' ? typeCompare : -typeCompare
        }
        return sortOrder.value === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      })
    }
    return [...sortedFolders.value, ...sortedItems.value]
  })

  // ==========================================
  // 2. Upload Logic
  // ==========================================
  const fileInput = ref<HTMLInputElement | null>(null)
  const folderInput = ref<HTMLInputElement | null>(null)

  const uploadFile = () => {
    fileInput.value?.click()
  }

  const uploadFolder = () => {
    folderInput.value?.click()
  }

  const isNameExists = (name: string, type: 'folder' | 'file') => {
    if (type === 'folder') {
      return currentFolders.value.some((f) => f.name === name)
    }
    return currentItems.value.some((i) => i.name === name)
  }

  const getUniqueName = (originalName: string, type: 'folder' | 'file') => {
    let name = originalName
    let ext = ''

    if (type === 'file') {
      const lastDotIndex = name.lastIndexOf('.')
      if (lastDotIndex !== -1) {
        ext = name.substring(lastDotIndex)
        name = name.substring(0, lastDotIndex)
      }
    }

    let finalName = originalName
    let counter = 2

    while (isNameExists(finalName, type)) {
      finalName = `${name} ${counter}${ext}`
      counter++
    }

    return finalName
  }

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    for (const file of Array.from(input.files)) {
      let fileType: FileItem['metadata']['fileType']
      if (file.type.startsWith('image/')) {
        fileType = 'image'
      } else if (file.type.startsWith('video/')) {
        fileType = 'video'
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf'
      } else {
        continue
      }

      try {
        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          name: getUniqueName(file.name, 'file'),
          url: URL.createObjectURL(file), // Default to blob URL for web
          size: file.size,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          metadata: {
            fileType,
            mimeType: file.type,
          },
          sourceType: 'local',
          permissions: { ...DEFAULT_LOCAL_PERMISSIONS },
        }

        if (fileSystem.isElectron.value) {
          try {
            const filePathSource = fileSystem.getFilePath(file)
            if (filePathSource) {
              const result = await fileSystem.saveFile(filePathSource)
              if (result.success && result.data) {
                newItem.url = result.data.fileUrl
                if (result.data.thumbnailData) {
                  const blob = new Blob([result.data.thumbnailData.buffer as ArrayBuffer], {
                    type: 'image/jpeg',
                  })
                  const blobId = uuidv4()
                  await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
                    id: blobId,
                    blob,
                    itemId: newItem.id,
                  })
                  newItem.metadata.thumbnailType = 'blob'
                  newItem.metadata.thumbnailBlobId = blobId
                }
              }
            }
          } catch (error) {
            console.error('Failed to save file in Electron:', error)
          }
        } else {
          showSnackBar(t('fileExplorer.uploadWebWarning'), 'warning', 5000)
        }

        mediaStore.addItemToCurrent(newItem)
      } catch (error) {
        console.error('Failed to process file:', file.name, error)
        showSnackBar(t('fileExplorer.uploadFailed'), 'error')
      }
    }
    input.value = ''
  }

  const handleFolderUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    const firstPath = input.files[0]?.webkitRelativePath
    if (!firstPath) return

    const rootFolderName = firstPath.split('/')[0]
    if (!rootFolderName) return

    const finalFolderName = getUniqueName(rootFolderName, 'folder')
    const oneDay = 24 * 60 * 60 * 1000
    mediaStore.addFolderToCurrent(finalFolderName, Date.now() + oneDay)

    const createdFolder = currentFolders.value.find((f) => f.name === finalFolderName)
    if (!createdFolder) {
      console.error('Failed to create folder')
      return
    }

    for (const file of Array.from(input.files)) {
      if (file.name.startsWith('.')) continue

      let fileType: FileItem['metadata']['fileType']
      if (file.type.startsWith('image/')) fileType = 'image'
      else if (file.type.startsWith('video/')) fileType = 'video'
      else if (file.type === 'application/pdf') fileType = 'pdf'
      else continue

      try {
        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          name: file.name,
          url: URL.createObjectURL(file), // Will be updated if Electron saves it
          size: file.size,
          timestamp: Date.now(),
          metadata: { fileType, mimeType: file.type },
          sourceType: 'local',
          permissions: { ...DEFAULT_LOCAL_PERMISSIONS },
        }

        if (fileSystem.isElectron.value) {
          try {
            const filePathSource = fileSystem.getFilePath(file)
            if (filePathSource) {
              const result = await fileSystem.saveFile(filePathSource)
              if (result.success && result.data) {
                newItem.url = result.data.fileUrl
                if (result.data.thumbnailData) {
                  const blob = new Blob([result.data.thumbnailData.buffer as ArrayBuffer], {
                    type: 'image/jpeg',
                  })
                  const blobId = uuidv4()
                  await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
                    id: blobId,
                    blob,
                    itemId: newItem.id,
                  })
                  newItem.metadata.thumbnailType = 'blob'
                  newItem.metadata.thumbnailBlobId = blobId
                }
              }
            }
          } catch (e) {
            console.error(e)
          }
        }

        mediaStore.addItemToFolder(createdFolder.id, newItem)
      } catch (e) {
        console.error(e)
      }
    }
    input.value = ''
  }

  // ==========================================
  // 3. Operational Logic
  // ==========================================

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
        if (folder) itemsToDelete.push(folder)
        else {
          const item = currentItems.value.find((i) => i.id === id)
          if (item) itemsToDelete.push(item)
        }
      })
    }

    // Delete physical files first
    await fileSystem.deletePhysicalFilesRecursive(itemsToDelete)

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
        if (folder) mediaStore.deleteFolder(id)
        else mediaStore.removeItemFromCurrent(id)
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

  // ... Thumbnail duplication ...
  const duplicateThumbnailBlob = async (
    thumbnailBlobId: string,
    newItemId: string,
  ): Promise<string | null> => {
    try {
      const originalThumbnail = await db.get<{ id: string; blob: Blob; itemId: string }>(
        FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
        thumbnailBlobId,
      )
      if (!originalThumbnail || !originalThumbnail.blob) return null

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

  // ... Physical File Duplication ...
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
      // It's a file
      const fileItem = item as FileItem
      if (!fileSystem.canEdit(fileItem)) return { ...fileItem }

      const result = await fileSystem.copyFile(fileItem)
      if (result.success && result.data) {
        const newItemId = uuidv4()
        const newMetadata = {
          ...fileItem.metadata,
          thumbnailUrl: fileItem.metadata.thumbnailUrl,
        }
        if (fileItem.metadata.thumbnailBlobId) {
          const newBlobId = await duplicateThumbnailBlob(
            fileItem.metadata.thumbnailBlobId,
            newItemId,
          )
          if (newBlobId) newMetadata.thumbnailBlobId = newBlobId
        }
        return {
          ...fileItem,
          id: newItemId,
          url: result.data.fileUrl,
          metadata: newMetadata,
        }
      }
      return { ...fileItem, id: uuidv4(), metadata: { ...fileItem.metadata } }
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
    // Original Operations
    isDuplicateName,
    nameErrorMessage,
    handleSave,
    confirmDeleteAction,
    handleCopy,
    handleCut,
    handlePaste,
    handlePasteIntoFolder,
    getUniqueName, // Exposed for external usage if needed

    // From MediaUpload
    fileInput,
    folderInput,
    uploadFile,
    uploadFolder,
    handleFileChange,
    handleFolderUpload,
    isNameExists,

    // From MediaSort
    sortBy,
    sortOrder,
    setSort,
    sortedFolders,
    sortedItems,
    sortedUnifiedItems,
  }
}
