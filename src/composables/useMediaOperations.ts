import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import { storeToRefs } from 'pinia'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { useMediaFolderStore } from '@/stores/folder'
import { useFileSystem } from '@/composables/useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useElectron } from '@/composables/useElectron'
import type { UseFolderDialogsReturn } from './useFolderDialogs'
import type { Folder, FileItem, ClipboardItem, SortBy, SortOrder } from '@/types/common'
import { FolderDBStore, MediaFolder } from '@/types/enum'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import { useSnackBar } from './useSnackBar'
import { useSettingsStore } from '@/stores/settings'
import { processPdfFile } from './usePdfProcessing'

// Video extensions that may not be recognized by browser MIME type detection
const VIDEO_EXTENSIONS = ['.mkv', '.avi', '.mov', '.wmv', '.flv', '.ts', '.m2ts', '.m4v']

// Non-native video extensions that require FFmpeg for transcoding
const NON_NATIVE_VIDEO_EXTENSIONS = ['.mkv', '.avi', '.mov', '.wmv', '.flv', '.ts', '.m2ts']

function isVideoExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return VIDEO_EXTENSIONS.includes(ext)
}

function isNonNativeVideoExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return NON_NATIVE_VIDEO_EXTENSIONS.includes(ext)
}

type MediaStore = ReturnType<typeof useMediaFolderStore>

export function useMediaOperations(
  mediaStore: MediaStore,
  dialogs: UseFolderDialogsReturn<FileItem>,
  selectedItems: { value: Set<string>; clear: () => void },
) {
  const { t } = useI18n()
  const fileSystem = useFileSystem()
  const db = useIndexedDB(FOLDER_DB_CONFIG)
  const { showSnackBar } = useSnackBar()
  const { isElectron, ffmpegCheckStatus } = useElectron()

  const settingsStore = useSettingsStore()
  const { isFfmpegEnabled } = storeToRefs(settingsStore)

  const canProjectItem = (item: FileItem): boolean => {
    if (item.metadata.fileType === 'image' || item.metadata.fileType === 'pdf') {
      return true
    }

    if (item.metadata.fileType === 'video' && isNonNativeVideoExtension(item.name)) {
      return isFfmpegEnabled.value
    }

    return true
  }

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
    hasClipboardItems,
  } = mediaStore

  // ==========================================
  // 1. Sorting Logic
  // ==========================================
  const sortBy = ref<SortBy>('name')
  const sortOrder = ref<SortOrder>('asc')

  const { currentFolder, viewMode } = storeToRefs(mediaStore)

  // Watch for folder changes to load settings or default
  watch(
    () => currentFolder.value,
    (folder: Folder<FileItem> | undefined) => {
      if (folder) {
        // Load settings from folder if available
        if (folder.viewSettings) {
          sortBy.value = folder.viewSettings.sortBy || 'name'
          sortOrder.value = folder.viewSettings.sortOrder || 'asc'
          // Sync global viewMode ref with folder setting
          if (folder.viewSettings.viewMode) {
            viewMode.value = folder.viewSettings.viewMode
          } else {
            viewMode.value = 'medium'
          }
        } else {
          // Default settings
          sortBy.value = 'name'
          sortOrder.value = 'asc'
          viewMode.value = 'medium'
        }
      }
    },
    { immediate: true, deep: true },
  )

  // Watch for viewMode changes (from UI) and save to folder
  watch(viewMode, (newMode: 'large' | 'medium' | 'small') => {
    if (currentFolder.value) {
      mediaStore.updateFolderViewSettings(currentFolder.value.id, {
        viewMode: newMode,
      })
    }
  })

  // Update setSort to save to folder
  const setSort = (type: SortBy) => {
    // If clicking the same type, cycle through: asc -> desc -> none (custom) -> asc
    let newOrder: SortOrder = 'asc'

    if (sortBy.value === type) {
      if (sortOrder.value === 'asc') {
        newOrder = 'desc'
      } else if (sortOrder.value === 'desc') {
        newOrder = 'none'
      } else {
        newOrder = 'asc'
      }
    } else {
      // Switching to a new type starts at 'asc'
      newOrder = 'asc'
    }

    sortBy.value = type
    sortOrder.value = newOrder

    // Save persistence
    if (currentFolder.value) {
      mediaStore.updateFolderViewSettings(currentFolder.value.id, {
        sortBy: type,
        sortOrder: newOrder,
      })
    }
  }

  // Type Guard Helper
  const isFolder = (item: FileItem | Folder<FileItem>): item is Folder<FileItem> => {
    return 'items' in item
  }

  // Helper to attach canPresent to item permissions
  const attachCanPresent = <T extends FileItem | Folder<FileItem>>(item: T): T => {
    // Folders always can present (they contain items)
    if ('items' in item) {
      return {
        ...item,
        permissions: {
          ...(item.permissions || DEFAULT_LOCAL_PERMISSIONS),
          canPresent: true,
        },
      }
    }
    // Files: compute canPresent based on type and FFmpeg status
    const fileItem = item as FileItem
    const canPresent = canProjectItem(fileItem)
    return {
      ...item,
      permissions: {
        ...(item.permissions || DEFAULT_LOCAL_PERMISSIONS),
        canPresent,
      },
    }
  }

  // Unified list for display - Single Source of Truth
  const sortedUnifiedItems = computed(() => {
    // Track isFfmpegEnabled to recompute canPresent when setting changes
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    isFfmpegEnabled.value

    // 1. If Custom mode (sortOrder is 'none'), return physical order from store
    if (sortOrder.value === 'none' || sortBy.value === 'custom') {
      const allItems = [...currentFolders.value, ...currentItems.value]
      // Attach canPresent to all items
      return allItems.map(attachCanPresent)
    }

    // 2. Otherwise, perform visual sorting
    // Principle: Folders Always First
    const folders = [...currentFolders.value]
    const items = [...currentItems.value]

    const direction = sortOrder.value === 'asc' ? 1 : -1

    // Sort strategy function based on current 'sortBy'
    const compareFn = (
      a: FileItem | Folder<FileItem>,
      b: FileItem | Folder<FileItem>,
      type: 'folder' | 'file',
    ) => {
      // Name Sort
      if (sortBy.value === 'name') {
        return a.name.localeCompare(b.name) * direction
      }

      // Date Sort
      if (sortBy.value === 'date') {
        const timeA = a.timestamp || 0
        const timeB = b.timestamp || 0
        return (timeA - timeB) * direction
      }

      // Type Sort (File Type)
      if (sortBy.value === 'type') {
        // Folders always sorted by Name when in Type mode
        if (type === 'folder') {
          return a.name.localeCompare(b.name) * direction
        }
        // Files sorted by fileType, then Name
        const typeA = (a as FileItem).metadata?.fileType || 'unknown'
        const typeB = (b as FileItem).metadata?.fileType || 'unknown'
        const typeCompare = typeA.localeCompare(typeB) * direction
        if (typeCompare !== 0) return typeCompare
        return a.name.localeCompare(b.name) * direction
      }

      return 0
    }

    // Apply sort to separated arrays
    folders.sort((a, b) => compareFn(a, b, 'folder'))
    items.sort((a, b) => compareFn(a, b, 'file'))

    // 3. Merge: Folders First, then attach canPresent to all items
    const merged = [...folders, ...items]
    return merged.map(attachCanPresent)
  })

  // Derived computed properties for backward compatibility if needed,
  // but mostly we should use sortedUnifiedItems in the template.
  const sortedFolders = computed(() => sortedUnifiedItems.value.filter(isFolder))
  const sortedItems = computed(
    () => sortedUnifiedItems.value.filter((i) => !isFolder(i)) as FileItem[],
  )

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
      } else if (file.type.startsWith('video/') || isVideoExtension(file.name)) {
        fileType = 'video'

        if (isNonNativeVideoExtension(file.name) && isElectron()) {
          if (!isFfmpegEnabled.value) {
            showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
            continue
          }
          const status = await ffmpegCheckStatus()
          if (!status.available) {
            showSnackBar(t('fileExplorer.ffmpegNotAvailable'), { color: 'error' })
            continue
          }
        }
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf'
      } else {
        continue
      }

      try {
        const currentPath = currentFolderPath.value
        const lastPathItem = currentPath[currentPath.length - 1]
        const parentFolderId: string =
          currentPath.length > 0 && lastPathItem ? lastPathItem : MediaFolder.ROOT_ID

        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          folderId: parentFolderId,
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

                // Apply video metadata if available (duration, mimeType)
                if (result.data.videoMetadata) {
                  newItem.metadata.duration = result.data.videoMetadata.duration
                  newItem.metadata.mimeType = result.data.videoMetadata.mimeType
                }

                if (result.data.thumbnailData) {
                  const blob = new Blob([result.data.thumbnailData.buffer as ArrayBuffer], {
                    type: 'image/jpeg',
                  })
                  // Use FileItem.id as thumbnail id (1:1 relationship)
                  await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
                    id: newItem.id,
                    blob,
                    createdAt: Date.now(),
                  })
                  newItem.metadata.thumbnailType = 'blob'
                  newItem.metadata.thumbnailBlobId = newItem.id
                }

                // PDF processing - extract page count and generate thumbnail using PDF.js
                if (fileType === 'pdf') {
                  try {
                    const pdfResult = await processPdfFile(newItem.url)
                    newItem.metadata.pageCount = pdfResult.pageCount

                    if (pdfResult.thumbnail) {
                      await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
                        id: newItem.id,
                        blob: pdfResult.thumbnail,
                        createdAt: Date.now(),
                      })
                      newItem.metadata.thumbnailType = 'blob'
                      newItem.metadata.thumbnailBlobId = newItem.id
                    }
                  } catch (pdfError) {
                    console.warn('Failed to process PDF:', pdfError)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Failed to save file in Electron:', error)
          }
        } else {
          showSnackBar(t('fileExplorer.uploadWebWarning'), {
            color: 'warning',
          })
        }

        mediaStore.addItemToCurrent(newItem)
      } catch (error) {
        console.error('Failed to process file:', file.name, error)
        showSnackBar(t('fileExplorer.uploadFailed'), {
          color: 'error',
        })
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
      else if (file.type.startsWith('video/') || isVideoExtension(file.name)) {
        fileType = 'video'

        if (isNonNativeVideoExtension(file.name) && isElectron()) {
          if (!isFfmpegEnabled.value) {
            showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
            continue
          }
          const status = await ffmpegCheckStatus()
          if (!status.available) {
            showSnackBar(t('fileExplorer.ffmpegNotAvailable'), { color: 'error' })
            continue
          }
        }
      } else if (file.type === 'application/pdf') fileType = 'pdf'
      else continue

      try {
        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          folderId: createdFolder.id,
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

                // Apply video metadata if available (duration, mimeType)
                if (result.data.videoMetadata) {
                  newItem.metadata.duration = result.data.videoMetadata.duration
                  newItem.metadata.mimeType = result.data.videoMetadata.mimeType
                }

                if (result.data.thumbnailData) {
                  const blob = new Blob([result.data.thumbnailData.buffer as ArrayBuffer], {
                    type: 'image/jpeg',
                  })
                  // Use FileItem.id as thumbnail id (1:1 relationship)
                  await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
                    id: newItem.id,
                    blob,
                    createdAt: Date.now(),
                  })
                  newItem.metadata.thumbnailType = 'blob'
                  newItem.metadata.thumbnailBlobId = newItem.id
                }

                // PDF processing - extract page count and generate thumbnail using PDF.js
                if (fileType === 'pdf') {
                  try {
                    const pdfResult = await processPdfFile(newItem.url)
                    newItem.metadata.pageCount = pdfResult.pageCount

                    if (pdfResult.thumbnail) {
                      await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
                        id: newItem.id,
                        blob: pdfResult.thumbnail,
                        createdAt: Date.now(),
                      })
                      newItem.metadata.thumbnailType = 'blob'
                      newItem.metadata.thumbnailBlobId = newItem.id
                    }
                  } catch (pdfError) {
                    console.warn('Failed to process PDF:', pdfError)
                  }
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
  }

  // ... Thumbnail duplication ...
  // Copies thumbnail from original FileItem.id to new FileItem.id
  const duplicateThumbnailBlob = async (
    originalItemId: string,
    newItemId: string,
  ): Promise<boolean> => {
    try {
      const originalThumbnail = await db.get<{ id: string; blob: Blob; createdAt?: number }>(
        FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
        originalItemId,
      )
      if (!originalThumbnail || !originalThumbnail.blob) return false

      // New thumbnail uses newItemId as its id (1:1 relationship)
      await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
        id: newItemId,
        blob: originalThumbnail.blob,
        createdAt: Date.now(),
      })
      return true
    } catch (error) {
      console.warn('Failed to duplicate thumbnail blob:', error)
      return false
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
        // Duplicate thumbnail: original FileItem.id -> new FileItem.id
        if (fileItem.metadata.thumbnailBlobId) {
          const success = await duplicateThumbnailBlob(fileItem.id, newItemId)
          if (success) newMetadata.thumbnailBlobId = newItemId
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
        const itemData = clipboardItem.data as FileItem | Folder<FileItem>
        const uniqueName = getUniqueName(itemData.name, type)

        const itemToPaste = await duplicatePhysicalFiles(
          clipboardItem.data as FileItem | Folder<FileItem>,
        )
        if (itemToPaste) {
          itemToPaste.name = uniqueName
          pasteItem(itemToPaste, targetFolderId, clipboardItem.type === 'file' ? 'file' : 'folder')
        }
      } else if (clipboardItem.action === 'cut') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        if (clipboardItem.sourceFolderId !== targetFolderId) {
          // Cast data to specific type to access 'name' and 'id'
          // FolderItem has 'name' and 'id', but TS might be confused by the generic or union
          const itemData = clipboardItem.data as FileItem | Folder<FileItem>
          const uniqueName = getUniqueName(itemData.name, type)

          if (uniqueName !== itemData.name) {
            if (type === 'folder') {
              mediaStore.updateFolder(itemData.id, { name: uniqueName })
            } else {
              mediaStore.updateItem(itemData.id, clipboardItem.sourceFolderId, {
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
    if (!hasClipboardItems()) return

    for (const clipboardItem of clipboard.value) {
      if (clipboardItem.action === 'copy') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        const itemData = clipboardItem.data as FileItem | Folder<FileItem>
        const uniqueName = getUniqueName(itemData.name, type)
        const itemToPaste = await duplicatePhysicalFiles(
          clipboardItem.data as FileItem | Folder<FileItem>,
        )
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
    if (!hasClipboardItems() && clipboard.value[0]?.action === 'cut') {
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
    getUniqueName,

    // FFmpeg / Projectability
    canProjectItem,
    updateFfmpegStatus: settingsStore.updateFfmpegStatus,
    isFfmpegEnabled,

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
