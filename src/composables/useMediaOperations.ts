import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import { useFileSystem } from '@/composables/useFileSystem'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { useMediaClipboard } from '@/composables/useMediaClipboard'
import { useMediaProcessing } from '@/composables/useMediaProcessing'
import { useSnackBar } from '@/composables/useSnackBar'
import type { UseFolderDialogsReturn } from './useFolderDialogs'
import type { Folder, FileItem, SortBy, SortOrder } from '@/types/folder'
import type { useMediaFolderStore } from '@/stores/folder'
import { MediaFolder } from '@/types/enum'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'

type MediaStore = ReturnType<typeof useMediaFolderStore>

export function useMediaOperations(
  mediaStore: MediaStore,
  dialogs: UseFolderDialogsReturn<FileItem>,
  selectedItems: { value: Set<string>; clear: () => void },
) {
  const { t } = useI18n()
  const fileSystem = useFileSystem()
  const { showSnackBar } = useSnackBar()

  const {
    currentFolderPath,
    getCurrentFolders: currentFolders,
    getCurrentItems: currentItems,
    clipboard,
    currentFolder,
    viewMode,
  } = storeToRefs(mediaStore)

  const {
    moveItem: moveItemAction,
    moveFolder: moveFolderAction,
    pasteItem,
    copyToClipboard,
    cutToClipboard,
    clearClipboard,
  } = mediaStore

  const sortBy = ref<SortBy>('name')
  const sortOrder = ref<SortOrder>('asc')

  watch(
    () => currentFolder.value,
    (folder) => {
      if (folder?.viewSettings) {
        sortBy.value = folder.viewSettings.sortBy || 'name'
        sortOrder.value = folder.viewSettings.sortOrder || 'asc'
        viewMode.value = folder.viewSettings.viewMode || 'medium'
      } else if (folder) {
        sortBy.value = 'name'
        sortOrder.value = 'asc'
        viewMode.value = 'medium'
      }
    },
    { immediate: true, deep: true },
  )

  watch(viewMode, (newMode) => {
    if (currentFolder.value) {
      mediaStore.updateFolderViewSettings(currentFolder.value.id, { viewMode: newMode })
    }
  })

  const setSort = (type: SortBy) => {
    let newOrder: SortOrder = 'asc'

    if (sortBy.value === type) {
      if (sortOrder.value === 'asc') newOrder = 'desc'
      else if (sortOrder.value === 'desc') newOrder = 'none'
      else newOrder = 'asc'
    }

    sortBy.value = type
    sortOrder.value = newOrder

    if (currentFolder.value) {
      mediaStore.updateFolderViewSettings(currentFolder.value.id, {
        sortBy: type,
        sortOrder: newOrder,
      })
    }
  }

  const isFolder = (item: FileItem | Folder<FileItem>): item is Folder<FileItem> => {
    return 'items' in item
  }

  const { canProjectItem, isFfmpegEnabled, updateFfmpegStatus } = useMediaProcessing()

  const attachCanPresent = <T extends FileItem | Folder<FileItem>>(item: T): T => {
    if ('items' in item) {
      return {
        ...item,
        permissions: { ...(item.permissions || DEFAULT_LOCAL_PERMISSIONS), canPresent: true },
      }
    }
    const canPresent = canProjectItem(item as FileItem)
    return {
      ...item,
      permissions: { ...(item.permissions || DEFAULT_LOCAL_PERMISSIONS), canPresent },
    }
  }

  const sortedUnifiedItems = computed(() => {
    void isFfmpegEnabled.value

    if (sortOrder.value === 'none' || sortBy.value === 'custom') {
      return [...currentFolders.value, ...currentItems.value].map(attachCanPresent)
    }

    const folders = [...currentFolders.value]
    const items = [...currentItems.value]
    const direction = sortOrder.value === 'asc' ? 1 : -1

    const compareFn = (
      a: FileItem | Folder<FileItem>,
      b: FileItem | Folder<FileItem>,
      type: 'folder' | 'file',
    ) => {
      if (sortBy.value === 'name') return a.name.localeCompare(b.name) * direction
      if (sortBy.value === 'date') return ((a.timestamp || 0) - (b.timestamp || 0)) * direction
      if (sortBy.value === 'type') {
        if (type === 'folder') return a.name.localeCompare(b.name) * direction
        const typeA = (a as FileItem).metadata?.fileType || 'unknown'
        const typeB = (b as FileItem).metadata?.fileType || 'unknown'
        const typeCompare = typeA.localeCompare(typeB) * direction
        return typeCompare !== 0 ? typeCompare : a.name.localeCompare(b.name) * direction
      }
      return 0
    }

    folders.sort((a, b) => compareFn(a, b, 'folder'))
    items.sort((a, b) => compareFn(a, b, 'file'))

    return [...folders, ...items].map(attachCanPresent)
  })

  const sortedFolders = computed(() => sortedUnifiedItems.value.filter(isFolder))
  const sortedItems = computed(
    () => sortedUnifiedItems.value.filter((i) => !isFolder(i)) as FileItem[],
  )

  const isNameExists = (name: string, type: 'folder' | 'file') => {
    return type === 'folder'
      ? currentFolders.value.some((f) => f.name === name)
      : currentItems.value.some((i) => i.name === name)
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

  const upload = useMediaUpload({
    isNameExists,
    getUniqueName,
    addItemToCurrent: mediaStore.addItemToCurrent,
    addFolderToCurrent: mediaStore.addFolderToCurrent,
    addItemToFolder: mediaStore.addItemToFolder,
    getCurrentFolders: () => currentFolders.value,
    currentFolderPath: () => currentFolderPath.value,
  })

  const clipboardOps = useMediaClipboard(
    {
      getCurrentFolders: () => currentFolders.value,
      getCurrentItems: () => currentItems.value,
      currentFolderPath: () => currentFolderPath.value,
      clipboard: () => clipboard.value,
      copyToClipboard,
      cutToClipboard,
      pasteItem,
      moveItemAction,
      moveFolderAction,
      clearClipboard,
      updateFolder: mediaStore.updateFolder,
      updateItem: mediaStore.updateItem,
      getUniqueName,
    },
    selectedItems,
  )

  const isDuplicateName = computed(() => {
    if (!dialogs.folderName.value.trim()) return false

    if (dialogs.editingType.value === 'file') {
      const fullName = dialogs.folderName.value.trim() + dialogs.editingExtension.value
      return currentItems.value.some(
        (i) =>
          !(dialogs.editingFolderId.value && i.id === dialogs.editingFolderId.value) &&
          i.name === fullName,
      )
    }
    return currentFolders.value.some(
      (f) =>
        !(dialogs.editingFolderId.value && f.id === dialogs.editingFolderId.value) &&
        f.name === dialogs.folderName.value.trim(),
    )
  })

  const nameErrorMessage = computed(() => {
    return isDuplicateName.value ? t('fileExplorer.duplicateFolderName') : ''
  })

  const handleSave = async () => {
    if (!dialogs.folderName.value.trim() || isDuplicateName.value) return

    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    let expiresAt: number | null = null

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
          expiresAt,
        })
      } else {
        const fullName = dialogs.folderName.value.trim() + dialogs.editingExtension.value
        const currentPath = currentFolderPath.value
        const parentId =
          currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
            ? MediaFolder.ROOT_ID
            : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

        mediaStore.updateItem(dialogs.editingFolderId.value, parentId, {
          name: fullName,
          expiresAt,
        })
      }
    } else {
      mediaStore.addFolderToCurrent(dialogs.folderName.value, expiresAt)
    }

    dialogs.showFolderDialog.value = false
    dialogs.folderName.value = ''
    dialogs.editingFolderId.value = null
  }

  const confirmDeleteAction = async () => {
    const itemsToDelete: (FileItem | Folder<FileItem>)[] = []

    if (dialogs.folderToDelete.value) {
      itemsToDelete.push(dialogs.folderToDelete.value)
    } else if (dialogs.itemToDelete.value) {
      itemsToDelete.push(dialogs.itemToDelete.value)
    } else {
      selectedItems.value.forEach((id) => {
        const folder = currentFolders.value.find((f) => f.id === id)
        const item = currentItems.value.find((i) => i.id === id)
        if (folder) itemsToDelete.push(folder)
        else if (item) itemsToDelete.push(item)
      })
    }

    await fileSystem.deletePhysicalFilesRecursive(itemsToDelete)

    if (dialogs.folderToDelete.value) {
      mediaStore.deleteFolder(dialogs.folderToDelete.value.id)
    } else if (dialogs.itemToDelete.value) {
      mediaStore.removeItemFromCurrent(dialogs.itemToDelete.value.id)
    } else {
      selectedItems.value.forEach((id) => {
        const folder = currentFolders.value.find((f) => f.id === id)
        if (folder) mediaStore.deleteFolder(id)
        else mediaStore.removeItemFromCurrent(id)
      })
    }

    selectedItems.clear()
    dialogs.showDeleteConfirmDialog.value = false
    dialogs.folderToDelete.value = null
    dialogs.itemToDelete.value = null
  }

  const handleMove = async (
    draggedItemsData: (FileItem | Folder<FileItem>)[],
    draggedType: string,
    target: Folder<FileItem>,
  ) => {
    const targetId = target.id
    const sourceFolderId = mediaStore.currentFolder?.id || MediaFolder.ROOT_ID
    let moveCount = 0

    const validItems = draggedItemsData.filter((item) => item.id !== targetId)

    for (const item of validItems) {
      if (draggedType === 'file') {
        const fileItem = currentItems.value.find((i) => i.id === item.id)
        if (fileItem) {
          mediaStore.moveItem(fileItem, targetId, sourceFolderId)
          moveCount++
        }
      } else if (draggedType === 'folder') {
        const folderItem = currentFolders.value.find((f) => f.id === item.id)
        if (folderItem) {
          const isLastItem = validItems.indexOf(item) === validItems.length - 1
          const moved = await mediaStore.moveFolder(
            folderItem,
            targetId,
            mediaStore.currentFolder?.id,
            !isLastItem,
          )
          if (moved) moveCount++
        }
      }
    }

    if (moveCount > 0) {
      showSnackBar(t('fileExplorer.moveSuccess'), { color: 'success' })
    }
  }

  const handleReorder = async (items: (FileItem | Folder<FileItem>)[]) => {
    const newFolders: Folder<FileItem>[] = []
    const newFiles: FileItem[] = []

    items.forEach((itm) => {
      if ('items' in itm) newFolders.push(itm as Folder<FileItem>)
      else newFiles.push(itm as FileItem)
    })

    await mediaStore.reorderCurrentFolders(newFolders)
    await mediaStore.reorderCurrentItems(newFiles)
  }

  return {
    isDuplicateName,
    nameErrorMessage,
    handleSave,
    confirmDeleteAction,
    handleCopy: clipboardOps.handleCopy,
    handleCut: clipboardOps.handleCut,
    handlePaste: clipboardOps.handlePaste,
    handlePasteIntoFolder: clipboardOps.handlePasteIntoFolder,
    getUniqueName,
    canProjectItem,
    updateFfmpegStatus,
    isFfmpegEnabled,
    fileInput: upload.fileInput,
    folderInput: upload.folderInput,
    uploadFile: upload.uploadFile,
    uploadFolder: upload.uploadFolder,
    handleFileChange: upload.handleFileChange,
    handleFolderUpload: upload.handleFolderUpload,
    isNameExists,
    sortBy,
    sortOrder,
    setSort,
    sortedFolders,
    sortedItems,
    sortedUnifiedItems,
    handleMove,
    handleReorder,
  }
}
