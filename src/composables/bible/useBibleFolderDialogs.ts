import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { VerseItem, Folder } from '@/types/common'
import { useBibleFolderStore } from '@/stores/folder'
import { useBibleStore } from '@/stores/bible'
import { useFolderDialogs } from '@/composables/useFolderDialogs'
import { BIBLE_CONFIG } from '@/config/app'
import { BibleFolder } from '@/types/enum'
import { isVerseItem, isFolder } from '@/utils/typeGuards'

interface UseBibleFolderDialogsOptions {
  currentFolder: ComputedRef<Folder<VerseItem>>
  currentFolderPath: Ref<string[]>
  activeTabSelection: Ref<Set<string>>
  multiFunctionTab: Ref<string>
  selectedItem: Ref<{ type: string; item: VerseItem | Folder<VerseItem> } | null>
  closeItemContextMenu: () => void
  removeFromCurrentFolder: (id: string) => void
}

export function useBibleFolderDialogs(options: UseBibleFolderDialogsOptions) {
  const { t: $t } = useI18n()
  const folderStore = useBibleFolderStore()
  const bibleStore = useBibleStore()

  const {
    currentFolder,
    currentFolderPath,
    activeTabSelection,
    multiFunctionTab,
    selectedItem,
    closeItemContextMenu,
    removeFromCurrentFolder,
  } = options

  const { getCurrentFolders, getCurrentItems: getCurrentVerses } = storeToRefs(folderStore)

  const {
    getFolderById,
    addFolderToCurrent,
    deleteFolder: deleteFolderAction,
    moveItem: moveItemAction,
    moveFolder: moveFolderAction,
    getMoveTargets,
    isFolderInside,
    updateFolder,
  } = folderStore

  const folderDialogs = useFolderDialogs<VerseItem>()
  const batchDeleteCount = ref(0)

  const isDuplicateName = computed(() => {
    if (!folderDialogs.folderName.value.trim()) return false
    return currentFolder.value.folders.some((f) => {
      if (folderDialogs.editingFolderId.value && f.id === folderDialogs.editingFolderId.value) {
        return false
      }
      return f.name === folderDialogs.folderName.value.trim()
    })
  })

  const nameErrorMessage = computed(() => {
    if (isDuplicateName.value) {
      return $t('fileExplorer.duplicateFolderName')
    }
    return ''
  })

  const currentFolderDepth = computed(() => {
    return currentFolderPath.value.length - 1
  })

  const isMaxDepthReached = computed(() => {
    return currentFolderDepth.value >= BIBLE_CONFIG.FOLDER.MAX_DEPTH
  })

  const moveItemType = computed(() => {
    if (folderDialogs.folderToMove.value) return 'folder'
    if (folderDialogs.itemToMove.value) return 'verse'
    return 'verse'
  })

  const canMoveToRoot = computed(() => {
    const isMovingSelection = folderDialogs.moveSelection.value.size > 0
    const isInRoot = currentFolder.value.id === BibleFolder.ROOT_ID

    if (isMovingSelection) {
      if (isInRoot) {
        return folderDialogs.selectedMoveFolder.value !== null
      }
      if (folderDialogs.selectedMoveFolder.value === null) return true
      const targetFolder = folderDialogs.selectedMoveFolder.value
      for (const id of folderDialogs.moveSelection.value) {
        const folder = getFolderById(id)
        if (folder && isFolderInside(folder, targetFolder)) {
          return false
        }
      }
      return true
    }

    if (moveItemType.value === 'verse') {
      if (!folderDialogs.itemToMove.value) return false
      if (isInRoot) {
        return folderDialogs.selectedMoveFolder.value !== null
      }
      return true
    } else {
      if (!folderDialogs.folderToMove.value) return false
      if (folderDialogs.selectedMoveFolder.value) {
        return !isFolderInside(
          folderDialogs.folderToMove.value,
          folderDialogs.selectedMoveFolder.value,
        )
      }
      if (isInRoot) return false
      return true
    }
  })

  const getMoveFolders = (): Folder<VerseItem>[] => {
    if (folderDialogs.moveSelection.value.size > 0) {
      let targets = getMoveTargets(folderDialogs.selectedMoveFolder.value)
      const selectedIds = folderDialogs.moveSelection.value

      targets = targets.filter((target) => {
        if (selectedIds.has(target.id)) return false
        for (const id of selectedIds) {
          const selectedFolder = getFolderById(id)
          if (selectedFolder && isFolderInside(selectedFolder, target)) return false
        }
        return true
      })
      return targets
    }

    const excludeFolderId =
      moveItemType.value === 'folder' && folderDialogs.folderToMove.value
        ? folderDialogs.folderToMove.value.id
        : undefined
    return getMoveTargets(folderDialogs.selectedMoveFolder.value, excludeFolderId)
  }

  const createNewFolder = () => {
    const baseName = $t('fileExplorer.defaultFolderName')
    let newName = baseName
    let counter = 2
    const existingNames = new Set(getCurrentFolders.value.map((f: Folder<VerseItem>) => f.name))
    while (existingNames.has(newName)) {
      newName = `${baseName} ${counter}`
      counter++
    }
    folderDialogs.openCreateFolderDialog(newName)
    closeItemContextMenu()
  }

  const openFolderSettings = (folder: Folder<VerseItem>) => {
    folderDialogs.openEditDialog(folder)
    if (folder.expiresAt === null || folder.expiresAt === undefined) {
      folderDialogs.retentionPeriod.value = 'permanent'
    } else {
      const diff = folder.expiresAt - folder.timestamp
      const oneDay = 24 * 60 * 60 * 1000
      if (diff > oneDay * 25) {
        folderDialogs.retentionPeriod.value = '1month'
      } else if (diff > oneDay * 6) {
        folderDialogs.retentionPeriod.value = '1week'
      } else {
        folderDialogs.retentionPeriod.value = '1day'
      }
    }
    closeItemContextMenu()
  }

  const confirmCreateFolder = () => {
    if (folderDialogs.folderName.value.trim() && !isDuplicateName.value) {
      let expiresAt: number | null = null
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      switch (folderDialogs.retentionPeriod.value) {
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

      if (folderDialogs.editingFolderId.value) {
        updateFolder(folderDialogs.editingFolderId.value, {
          name: folderDialogs.folderName.value,
          expiresAt: expiresAt,
        })
      } else {
        addFolderToCurrent(folderDialogs.folderName.value, expiresAt)
      }
      folderDialogs.showFolderDialog.value = false
      folderDialogs.folderName.value = ''
      folderDialogs.editingFolderId.value = null
    }
  }

  const confirmDeleteFolder = (
    customFolderTabRef?: Ref<{ deleteSelectedItems: () => void } | null>,
  ) => {
    if (batchDeleteCount.value > 0) {
      const itemsToDelete = Array.from(activeTabSelection.value)
      if (multiFunctionTab.value === 'custom') {
        itemsToDelete.forEach((id) => {
          let folder = getFolderById(id)
          if (!folder) {
            const found = getCurrentFolders.value.find((f: Folder<VerseItem>) => f.id === id)
            if (found) folder = found
          }
          if (folder) {
            deleteFolderAction(id)
          } else {
            removeFromCurrentFolder(id)
          }
        })
        customFolderTabRef?.value?.deleteSelectedItems()
        activeTabSelection.value.clear()
      } else if (multiFunctionTab.value === 'history') {
        itemsToDelete.forEach((id) => {
          bibleStore.removeHistoryItem(id)
        })
        activeTabSelection.value.clear()
      }
      batchDeleteCount.value = 0
      folderDialogs.showDeleteConfirmDialog.value = false
      return
    }

    if (folderDialogs.folderToDelete.value) {
      deleteFolderAction(folderDialogs.folderToDelete.value.id)
    }
    folderDialogs.showDeleteConfirmDialog.value = false
    folderDialogs.folderToDelete.value = null
  }

  const confirmMoveVerse = async (targetId: string) => {
    if (!canMoveToRoot.value) return
    const destinationId =
      targetId || folderDialogs.selectedMoveFolder.value?.id || BibleFolder.ROOT_ID
    const sourceFolderId =
      currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

    if (folderDialogs.moveSelection.value.size > 0) {
      const promises: Promise<void | boolean>[] = []
      for (const id of folderDialogs.moveSelection.value) {
        const folder = getFolderById(id)
        if (folder) {
          promises.push(moveFolderAction(folder, destinationId, sourceFolderId, false))
        } else {
          const verse = getCurrentVerses.value.find((v: VerseItem) => v.id === id)
          if (verse) {
            promises.push(moveItemAction(verse, destinationId, sourceFolderId))
          }
        }
      }
      await Promise.all(promises)
    } else if (moveItemType.value === 'verse') {
      if (!folderDialogs.itemToMove.value) return
      await moveItemAction(
        folderDialogs.itemToMove.value as VerseItem,
        destinationId,
        sourceFolderId,
      )
    } else {
      if (!folderDialogs.folderToMove.value) return
      await moveFolderAction(folderDialogs.folderToMove.value, destinationId, sourceFolderId)
    }

    folderDialogs.showMoveDialog.value = false
    folderDialogs.itemToMove.value = null
    folderDialogs.folderToMove.value = null
    folderDialogs.selectedMoveFolder.value = null
    folderDialogs.moveSelection.value.clear()
    folderDialogs.moveBreadcrumb.value = []
  }

  const navigateMoveToRoot = () => {
    folderDialogs.moveBreadcrumb.value = [{ id: BibleFolder.ROOT_ID, name: BibleFolder.ROOT_NAME }]
    folderDialogs.selectedMoveFolder.value = null
  }

  const navigateMoveToFolder = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      const index = folderDialogs.moveBreadcrumb.value.findIndex((b) => b.id === folderId)
      const newPath =
        index !== -1
          ? folderDialogs.moveBreadcrumb.value.slice(0, index + 1)
          : [...folderDialogs.moveBreadcrumb.value, { id: folder.id, name: folder.name }]
      folderDialogs.moveBreadcrumb.value = newPath
      folderDialogs.selectedMoveFolder.value = folder
    }
  }

  const handleMoveNavigate = (id: string) => {
    if (id === BibleFolder.ROOT_ID) {
      navigateMoveToRoot()
    } else {
      navigateMoveToFolder(id)
    }
  }

  const showMoveItemDialog = () => {
    if (!selectedItem.value || selectedItem.value.type === 'history') return
    const item = selectedItem.value.item

    if (activeTabSelection.value.has(item.id) && activeTabSelection.value.size > 0) {
      folderDialogs.openMoveSelectedDialog(activeTabSelection.value)
      folderDialogs.moveBreadcrumb.value = [
        { id: BibleFolder.ROOT_ID, name: BibleFolder.ROOT_NAME },
      ]
    } else {
      folderDialogs.openMoveDialog(item)
      folderDialogs.moveBreadcrumb.value = [
        { id: BibleFolder.ROOT_ID, name: BibleFolder.ROOT_NAME },
      ]
    }
    closeItemContextMenu()
  }

  const deleteItem = () => {
    if (activeTabSelection.value.size > 0) {
      batchDeleteCount.value = activeTabSelection.value.size
      folderDialogs.openDeleteSelectionDialog()
      closeItemContextMenu()
      return
    }

    if (!selectedItem.value) return
    const itemType = selectedItem.value.type
    const item = selectedItem.value.item

    if (itemType === 'verse' && isVerseItem(item)) {
      removeFromCurrentFolder(item.id)
    } else if (itemType === 'folder' && isFolder(item)) {
      const folder = getFolderById(item.id)
      if (folder) folderDialogs.openDeleteFolderDialog(folder)
    } else if (itemType === 'history' && isVerseItem(item)) {
      bibleStore.removeHistoryItem(item.id)
    }
    closeItemContextMenu()
  }

  const showFolderSettings = () => {
    if (selectedItem.value?.type === 'folder' && isFolder(selectedItem.value.item)) {
      openFolderSettings(selectedItem.value.item)
    }
  }

  const showDeleteFolderDialog = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      folderDialogs.openDeleteFolderDialog(folder)
    }
  }

  return {
    folderDialogs,
    batchDeleteCount,
    isDuplicateName,
    nameErrorMessage,
    isMaxDepthReached,
    createNewFolder,
    openFolderSettings,
    confirmCreateFolder,
    confirmDeleteFolder,
    confirmMoveVerse,
    handleMoveNavigate,
    showMoveItemDialog,
    deleteItem,
    showFolderSettings,
    getMoveFolders,
    showDeleteFolderDialog,
  }
}
