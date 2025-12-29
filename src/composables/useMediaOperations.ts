import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { APP_CONFIG } from '@/config/app'
import { useMediaStore } from '@/stores/media'
import { useElectron } from '@/composables/useElectron'
import type { UseFolderDialogsReturn } from './useFolderDialogs'
import type { Folder, FileItem, ClipboardItem } from '@/types/common'

type MediaStore = ReturnType<typeof useMediaStore>

export function useMediaOperations(
  mediaStore: MediaStore,
  dialogs: UseFolderDialogsReturn<FileItem>,
  selectedItems: { value: Set<string>; clear: () => void }, // Pass ref-like object or just the ref
  showSnackBar: (message: string, color?: string, timeout?: number, location?: string) => void,
  getUniqueName: (name: string, type: 'folder' | 'file') => string,
) {
  const { t } = useI18n()
  const { isElectron, deleteFile } = useElectron()
  const {
    currentFolderPath,
    getCurrentFolders: currentFolders,
    getCurrentItems: currentItems,
    clipboard,
    currentFolder,
  } = storeToRefs(mediaStore)

  const {
    moveItem: moveItemAction,
    moveFolder: moveFolderAction,
    getMoveTargets,
    getFolderById,
    isFolderInside,
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
            currentPath.length > 0 &&
            currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
              ? APP_CONFIG.FOLDER.ROOT_ID
              : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

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
  const handleItemDelete = async (item: FileItem) => {
    if (isElectron() && item.url.startsWith('local-resource://')) {
      // Extract path from local-resource://
      // On Windows: local-resource://C:/path/to/file.ext -> C:\path\to\file.ext
      // On Mac: local-resource:///Users/path/file.ext -> /Users/path/file.ext
      let path = item.url.replace('local-resource://', '')
      if (window.electronAPI && (await window.electronAPI.getSystemLocale())) {
        // Dummy check or just use decodeURI?
        path = decodeURIComponent(path)
      }
      // Simple decode
      path = decodeURIComponent(path)

      await deleteFile(path)
    }
  }

  const confirmDeleteAction = async () => {
    if (dialogs.folderToDelete.value) {
      // We don't support deleting folder contents physically yet (complexity), just DB
      mediaStore.deleteFolder(dialogs.folderToDelete.value.id)
      selectedItems.clear()
    } else if (dialogs.itemToDelete.value) {
      await handleItemDelete(dialogs.itemToDelete.value)
      mediaStore.removeItemFromCurrent(dialogs.itemToDelete.value.id)
      selectedItems.clear()
    } else {
      // Bulk delete
      for (const id of selectedItems.value) {
        // Try delete as folder first, then item
        const folder = currentFolders.value.find((f) => f.id === id)
        if (folder) {
          mediaStore.deleteFolder(id)
        } else {
          const item = currentItems.value.find((i) => i.id === id)
          if (item) {
            await handleItemDelete(item)
            mediaStore.removeItemFromCurrent(id)
          }
        }
      }
      selectedItems.clear()
    }
    dialogs.showDeleteConfirmDialog.value = false
    dialogs.folderToDelete.value = null
    dialogs.itemToDelete.value = null
  }

  // --- Move ---
  const getFolderPath = (folderId: string): { id: string; name: string }[] => {
    const path: { id: string; name: string }[] = []
    let current = getFolderById(folderId)
    while (current) {
      path.unshift({ id: current.id, name: current.name })
      if (current.id === APP_CONFIG.FOLDER.ROOT_ID || !current.parentId) break
      current = getFolderById(current.parentId)
    }
    return path
  }

  const navigateMoveToFolder = (folderId: string) => {
    if (folderId === APP_CONFIG.FOLDER.ROOT_ID) {
      dialogs.moveBreadcrumb.value = []
      dialogs.selectedMoveFolder.value = null
      return
    }

    const path = getFolderPath(folderId)
    if (!path) return

    dialogs.moveBreadcrumb.value = path
    dialogs.selectedMoveFolder.value = null
  }

  const getMoveFolderTargets = () => {
    const excludeFolderId =
      dialogs.moveType.value === 'folder' && dialogs.folderToMove.value
        ? dialogs.folderToMove.value.id
        : undefined
    return getMoveTargets(dialogs.selectedMoveFolder.value, excludeFolderId)
  }

  const confirmMove = (targetId: string) => {
    const destId = targetId || dialogs.selectedMoveFolder.value?.id || APP_CONFIG.FOLDER.ROOT_ID

    dialogs.moveSelection.value.forEach((id) => {
      // Check for self-containment loop
      if (id === destId) return // Cannot move into self

      const folder = currentFolders.value.find((f) => f.id === id)
      if (folder) {
        // Check if moving folder into its own child
        if (destId !== APP_CONFIG.FOLDER.ROOT_ID) {
          const targetFolder = getFolderById(destId)
          if (targetFolder && isFolderInside(folder, targetFolder)) return
        }

        mediaStore.moveFolder(folder, destId, currentFolder.value?.id)
      } else {
        const item = currentItems.value.find((i) => i.id === id)
        if (item) {
          mediaStore.moveItem(item, destId, currentFolder.value?.id)
        }
      }
    })

    dialogs.showMoveDialog.value = false
    selectedItems.clear()
    showSnackBar(t('fileExplorer.moveSuccess'), 'success')
  }

  // --- Clipboard ---
  const handleCopy = () => {
    if (selectedItems.value.size === 0) return

    const items: ClipboardItem<FileItem>[] = []
    const currentPath = currentFolderPath.value
    const sourceFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
        ? APP_CONFIG.FOLDER.ROOT_ID
        : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

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
      currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
        ? APP_CONFIG.FOLDER.ROOT_ID
        : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

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

  const handlePaste = () => {
    if (clipboard.value.length === 0) return

    const currentPath = currentFolderPath.value
    const targetFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
        ? APP_CONFIG.FOLDER.ROOT_ID
        : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

    clipboard.value.forEach((clipboardItem) => {
      if (clipboardItem.action === 'copy') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        const uniqueName = getUniqueName(clipboardItem.data.name, type)

        const itemToPaste = { ...clipboardItem.data, name: uniqueName }

        pasteItem(itemToPaste, targetFolderId, clipboardItem.type === 'file' ? 'file' : 'folder')
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
    })

    if (clipboard.value.length > 0 && clipboard.value[0]?.action === 'cut') {
      clearClipboard()
    }
  }

  return {
    isDuplicateName,
    nameErrorMessage,
    handleSave,
    confirmDeleteAction,
    navigateMoveToFolder,
    getMoveFolderTargets,
    confirmMove,
    handleCopy,
    handleCut,
    handlePaste,
  }
}
