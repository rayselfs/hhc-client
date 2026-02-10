<template>
  <v-card
    :style="{ height: props.containerHeight ? `${props.containerHeight}px` : '100%' }"
    rounded="lg"
  >
    <v-card-title class="d-flex align-center justify-space-between pa-0">
      <div class="d-flex align-center">
        <v-btn-toggle v-model="multiFunctionTab" mandatory class="rounded-0 border-e-sm">
          <v-btn value="history" size="small" :title="$t('common.history')">
            <v-icon size="x-large">mdi-history</v-icon>
          </v-btn>
          <v-btn value="custom" size="small" :title="$t('common.custom')">
            <v-icon size="x-large">mdi-folder</v-icon>
          </v-btn>
        </v-btn-toggle>
        <!-- Folder Breadcrumbs -->
        <div v-if="multiFunctionTab === 'custom'" class="ml-3">
          <FolderBreadcrumbs
            :items="breadcrumbItems"
            :always-enable-root="false"
            @navigate="handleNavigateToFolder"
          />
        </div>
      </div>
      <div class="d-flex align-center">
        <v-btn
          variant="text"
          icon
          class="ignore-selection-clear"
          @click="handleExport"
          :disabled="isExportDisabled"
          :title="$t('common.export')"
        >
          <v-icon>mdi-export-variant</v-icon>
        </v-btn>
        <v-btn
          v-if="multiFunctionTab === 'history'"
          variant="text"
          icon
          @click="clearHistory"
          :disabled="historyVerses.length === 0"
          :title="$t('common.delete')"
        >
          <v-icon>mdi-delete-sweep</v-icon>
        </v-btn>
        <v-btn
          v-if="multiFunctionTab === 'custom'"
          variant="text"
          icon
          @click="createNewFolder"
          :disabled="isMaxDepthReached"
          :title="$t('fileExplorer.newFolder')"
        >
          <v-icon>mdi-folder-plus</v-icon>
        </v-btn>
      </div>
    </v-card-title>

    <v-divider />

    <v-card-text
      class="pa-0"
      :style="{
        height: props.containerHeight ? `${props.containerHeight - 48}px` : 'calc(100% - 48px)',
        overflowY: multiFunctionTab === 'history' ? 'hidden' : 'auto',
      }"
      @contextmenu="handleCardTextRightClick"
    >
      <!-- History Page -->
      <HistoryTab
        v-if="multiFunctionTab === 'history'"
        :history-verses="historyVerses"
        :container-height="props.containerHeight"
        @load-verse="(item: VerseItem) => loadVerse(item, 'history')"
        @remove-item="removeHistoryItem"
        @right-click="
          (event: MouseEvent, item: VerseItem) => handleRightClick(event, 'history', item)
        "
        @selection-change="handleSelectionChange"
        ref="historyTabRef"
      />

      <!-- Custom Page -->
      <CustomFolderTab
        v-else
        :folders="getCurrentFolders"
        :verses="getCurrentVerses"
        @load-verse="(item: VerseItem) => loadVerse(item, 'custom')"
        @remove-item="removeFromCurrentFolder"
        @enter-folder="handleEnterFolder"
        @delete-folder="showDeleteFolderDialog"
        @drop="handleDropToFolder"
        @right-click="handleRightClick"
        @paste="pasteItemHandler"
        @selection-change="handleSelectionChange"
        ref="customFolderTabRef"
      />
    </v-card-text>

    <!-- Create/Edit Folder Dialog -->
    <CreateEditFolderDialog
      v-model="folderDialogs.showFolderDialog.value"
      :title="
        folderDialogs.editingFolderId.value
          ? $t('fileExplorer.folderSettings')
          : $t('fileExplorer.newFolder')
      "
      :folder-name="folderDialogs.folderName.value"
      @update:folder-name="folderDialogs.folderName.value = $event"
      :retention-period="folderDialogs.retentionPeriod.value"
      @update:retention-period="folderDialogs.retentionPeriod.value = $event"
      :retention-options="folderDialogs.retentionOptions.value"
      :error-messages="nameErrorMessage"
      :disable-confirm="isDuplicateName"
      :confirm-text="
        folderDialogs.editingFolderId.value ? $t('common.confirm') : $t('common.create')
      "
      show-retention
      @confirm="confirmCreateFolder"
    />

    <!-- Move Dialog -->
    <MoveFolderDialog
      v-model="folderDialogs.showMoveDialog.value"
      :breadcrumbs="moveBreadcrumbItems"
      :targets="getMoveFolders()"
      @navigate="handleMoveNavigate"
      @move="confirmMoveVerse"
    />

    <!-- Delete Confirm Dialog -->
    <DeleteConfirmDialog
      v-model="folderDialogs.showDeleteConfirmDialog.value"
      :item-name="folderDialogs.folderToDelete.value?.name"
      :is-folder="!!folderDialogs.folderToDelete.value"
      :count="batchDeleteCount"
      @confirm="confirmDeleteFolder"
    />

    <!-- Item Context Menu -->
    <ContextMenu v-model="showItemContextMenu" :position="menuPosition" close-on-content-click raw>
      <BibleVerseContextMenu
        v-if="selectedItem"
        :type="selectedItem.type === 'history' ? 'history' : 'custom'"
        :is-folder="isFolder(selectedItem.item)"
        @copy="copyItem"
        @move="showMoveItemDialog"
        @edit="showFolderSettings"
        @delete="deleteItem"
      />
    </ContextMenu>

    <!-- Background Context Menu -->
    <ContextMenu
      v-model="showBackgroundContextMenu"
      :position="menuPosition"
      close-on-content-click
      raw
    >
      <BibleBackgroundContextMenu
        :has-clipboard="hasClipboardItems()"
        @paste="pasteItemHandler"
        @create-folder="createNewFolder"
      />
    </ContextMenu>
  </v-card>
</template>

<script setup lang="ts">
defineOptions({
  name: 'BibleMultiFunctionControl',
})

import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { VerseItem, Folder } from '@/types/common'
import { useBibleFolderStore } from '@/stores/folder'
import { useBibleStore } from '@/stores/bible'
import { isVerseItem, isFolder, type DragData } from '@/utils/typeGuards'
import ContextMenu from '@/components/ContextMenu.vue'
import { BibleBackgroundContextMenu, BibleVerseContextMenu } from '@/components/Bible'
import HistoryTab from './HistoryTab.vue'
import CustomFolderTab from './CustomFolderTab.vue'
import FolderBreadcrumbs from '@/components/Shared/FolderBreadcrumbs.vue'
import MoveFolderDialog from '@/components/Shared/MoveFolderDialog.vue'
import CreateEditFolderDialog from '@/components/Shared/CreateEditFolderDialog.vue'
import DeleteConfirmDialog from '@/components/Shared/DeleteConfirmDialog.vue'
import { useFolderDialogs } from '@/composables/useFolderDialogs'
import { BIBLE_CONFIG } from '@/config/app'
import { BibleFolder } from '@/types/enum'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import { useBibleExport } from '@/composables/bible/useBibleExport'
import { useBibleContextMenu } from '@/composables/bible/useBibleContextMenu'
import { useBibleClipboard } from '@/composables/bible/useBibleClipboard'

const { t: $t } = useI18n()

// Props
interface Props {
  containerHeight?: number
}

// Emits
interface Emits {
  (e: 'load-verse', item: VerseItem, type: 'history' | 'custom'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Bible store - for history management
const bibleStore = useBibleStore()
const { historyVerses } = storeToRefs(bibleStore)
const { removeHistoryItem, clearHistory } = bibleStore

// Bible composable - for folder management
const folderStore = useBibleFolderStore()

// Folder store - for all folder operations
const {
  currentFolderPath,
  currentFolder,
  getCurrentFolders,
  getCurrentItems: getCurrentVerses,
  clipboard,
} = storeToRefs(folderStore)
const {
  navigateToRoot,
  navigateToFolder,
  enterFolder,
  addFolderToCurrent,
  removeItemFromCurrent,
  deleteFolder: deleteFolderAction,
  moveItem: moveItemAction,
  moveFolder: moveFolderAction,
  pasteItem,
  getFolderById,
  getMoveTargets,
  isFolderInside,
  updateFolder,
  copyToClipboard,
  hasClipboardItems,
  clearClipboard,
} = folderStore

// Status
const multiFunctionTab = ref('history')
const folderDialogs = useFolderDialogs<VerseItem>()
const customSelectedItems = ref<Set<string>>(new Set())
const activeTabSelection = ref<Set<string>>(new Set())
const batchDeleteCount = ref(0)

const handleSelectionChange = (selection: Set<string>) => {
  activeTabSelection.value = selection
  // Also sync custom specific logic (ensure export still works with customSelectedItems)
  customSelectedItems.value = selection
}

const customFolderTabRef = ref<InstanceType<typeof CustomFolderTab> | null>(null)
const historyTabRef = ref<InstanceType<typeof HistoryTab> | null>(null)

// Export Logic (extracted to composable)
const { isExportDisabled, handleExport } = useBibleExport({
  historyVerses,
  getCurrentFolders,
  getCurrentVerses,
  currentFolder,
  customSelectedItems,
  multiFunctionTab,
  getFolderById,
})

// Context Menu Logic (extracted to composable)
const {
  showItemContextMenu,
  showBackgroundContextMenu,
  menuPosition,
  selectedItem,
  handleRightClick,
  handleCardTextRightClick,
  closeItemContextMenu,
} = useBibleContextMenu()

// Clipboard Operations (extracted to composable)
const { copyItem, pasteItemHandler } = useBibleClipboard({
  selectedItem,
  activeTabSelection,
  multiFunctionTab,
  customFolderTabRef,
  historyTabRef,
  currentFolder,
  clipboard,
  closeItemContextMenu,
  copyToClipboard,
  hasClipboardItems,
  moveItemAction,
  pasteItem,
  moveFolderAction,
  updateFolder,
  clearClipboard,
  getCurrentFolders,
})

// Check for duplicate folder name
const isDuplicateName = computed(() => {
  if (!folderDialogs.folderName.value.trim()) return false
  return currentFolder.value.folders.some((f) => {
    // If editing, exclude self from check
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

const breadcrumbItems = computed(() => {
  return currentFolderPath.value.map((id) => ({
    id,
    name: getFolderById(id)?.name || '',
  }))
})

const moveBreadcrumbItems = computed(() => {
  return folderDialogs.moveBreadcrumb.value
})

// Watch tab change, reset to root when switching to custom
watch(multiFunctionTab, (newTab) => {
  if (newTab === 'custom') {
    navigateToRoot()
  }
})

// Move related state (Derived from folderDialogs)
const moveItemType = computed(() => {
  if (folderDialogs.folderToMove.value) return 'folder'
  if (folderDialogs.itemToMove.value) return 'verse'
  return 'verse' // Default
})

const loadVerse = (item: VerseItem, type: 'history' | 'custom') => {
  emit('load-verse', item, type)
}

// Custom Folder Functions
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
    // Calculate approximate retention period
    const diff = folder.expiresAt - folder.timestamp // Use creation time to determine original setting
    const oneDay = 24 * 60 * 60 * 1000

    // Simple heuristic mapping
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
      // Update existing folder
      updateFolder(folderDialogs.editingFolderId.value, {
        name: folderDialogs.folderName.value,
        expiresAt: expiresAt,
      })
    } else {
      // Create new folder
      addFolderToCurrent(folderDialogs.folderName.value, expiresAt)
    }

    folderDialogs.showFolderDialog.value = false
    folderDialogs.folderName.value = ''
    folderDialogs.editingFolderId.value = null
  }
}

// Navigation functions (now use store actions)
const handleNavigateToFolder = (folderId: string) => {
  navigateToFolder(folderId)
}

const handleEnterFolder = (folderId: string) => {
  enterFolder(folderId)
}

const showDeleteFolderDialog = (folderId: string) => {
  const folder = getFolderById(folderId)
  if (folder) {
    folderDialogs.openDeleteFolderDialog(folder)
  }
}

const confirmDeleteFolder = () => {
  // Batch Delete
  if (batchDeleteCount.value > 0) {
    const itemsToDelete = Array.from(activeTabSelection.value)

    if (multiFunctionTab.value === 'custom') {
      itemsToDelete.forEach((id) => {
        // Attempt to find as folder first (more destructive)
        let folder = getFolderById(id)
        if (!folder) {
          const found = getCurrentFolders.value.find((f: Folder<VerseItem>) => f.id === id)
          if (found) folder = found
        }

        if (folder) {
          deleteFolderAction(id)
        } else {
          // Assume verse
          removeItemFromCurrent(id)
        }
      })
      // Clear selection after delete
      customFolderTabRef.value?.deleteSelectedItems() // This cleans up UI state in child if needed, or we just rely on store update
      // Actually we should just clear selection manually since items are gone.
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

  // Single Delete
  if (folderDialogs.folderToDelete.value) {
    deleteFolderAction(folderDialogs.folderToDelete.value.id)
  }
  folderDialogs.showDeleteConfirmDialog.value = false
  folderDialogs.folderToDelete.value = null
}

const removeFromCurrentFolder = (itemId: string) => {
  // Call store action - direct mutation
  removeItemFromCurrent(itemId)
}

// Handle drag and drop to folder
const handleDropToFolder = async (data: DragData<VerseItem>, targetFolder: Folder<VerseItem>) => {
  const item = data.items[0]

  // Check if we are dragging a selected item
  const isMultiSelect =
    item && activeTabSelection.value.has(item.id) && activeTabSelection.value.size > 0

  if (isMultiSelect) {
    // Batch Move
    const sourceFolderId =
      currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id
    const promises: Promise<void | boolean>[] = []

    for (const id of activeTabSelection.value) {
      // Check if it's a folder
      const folder = getFolderById(id)
      if (folder) {
        if (!isFolderInside(folder, targetFolder)) {
          promises.push(moveFolderAction(folder, targetFolder.id, sourceFolderId))
        }
      } else {
        // Assume verse
        const verse = getCurrentVerses.value.find((v) => v.id === id)
        if (verse) {
          promises.push(moveItemAction(verse, targetFolder.id, sourceFolderId))
        }
      }
    }
    await Promise.all(promises)
    activeTabSelection.value.clear()
  } else {
    // Single Item Move
    if (data.type === 'verse' && isVerseItem(item)) {
      moveVerseToFolder(item as VerseItem, targetFolder)
    } else if (data.type === 'folder' && isFolder(item)) {
      moveFolderToFolder(item as Folder<VerseItem>, targetFolder)
    }
  }
}

// Move verse to folder (drag & drop)
const moveVerseToFolder = (verse: VerseItem, targetFolder: Folder<VerseItem>) => {
  const sourceFolderId =
    currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id
  // Call store action - direct mutation
  moveItemAction(verse, targetFolder.id, sourceFolderId)
}

// Move folder to another folder (drag & drop)
const moveFolderToFolder = (folderToMove: Folder<VerseItem>, targetFolder: Folder<VerseItem>) => {
  const sourceFolderId =
    currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id
  moveFolderAction(folderToMove, targetFolder.id, sourceFolderId)
}

// Move verse related functions
const showMoveDialog = (item: VerseItem) => {
  folderDialogs.openMoveDialog(item)
  // Ensure breadcrumb starts with root
  folderDialogs.moveBreadcrumb.value = [{ id: BibleFolder.ROOT_ID, name: BibleFolder.ROOT_NAME }]
}

// Move Folder Functions
const showMoveFolderDialog = (item: Folder<VerseItem>) => {
  folderDialogs.openMoveDialog(item)
  // Ensure breadcrumb starts with root
  folderDialogs.moveBreadcrumb.value = [{ id: BibleFolder.ROOT_ID, name: BibleFolder.ROOT_NAME }]
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

// Used by MoveFolderDialog component
const getMoveFolders = (): Folder<VerseItem>[] => {
  // If moving selection, we must filter out any selected folders AND their children
  if (folderDialogs.moveSelection.value.size > 0) {
    let targets = getMoveTargets(folderDialogs.selectedMoveFolder.value)
    const selectedIds = folderDialogs.moveSelection.value

    targets = targets.filter((target) => {
      // 1. Target cannot be one of the selected folders
      if (selectedIds.has(target.id)) return false

      // 2. Target cannot be inside any of the selected folders
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

const handleMoveNavigate = (id: string) => {
  if (id === BibleFolder.ROOT_ID) {
    navigateMoveToRoot()
  } else {
    navigateMoveToFolder(id)
  }
}

// Check if can move to root
const canMoveToRoot = computed(() => {
  const isMovingSelection = folderDialogs.moveSelection.value.size > 0
  const isInRoot = currentFolder.value.id === BibleFolder.ROOT_ID

  if (isMovingSelection) {
    // If in root, can only move to a subfolder
    if (isInRoot) {
      return folderDialogs.selectedMoveFolder.value !== null
    }

    // If not in root, can always move to root (target is null)
    if (folderDialogs.selectedMoveFolder.value === null) return true

    // Circular check: Prevent moving a folder into itself or its children
    const targetFolder = folderDialogs.selectedMoveFolder.value
    for (const id of folderDialogs.moveSelection.value) {
      const folder = getFolderById(id)
      if (folder && isFolderInside(folder, targetFolder)) {
        return false
      }
    }
    return true
  }

  // Single Item Logic
  if (moveItemType.value === 'verse') {
    if (!folderDialogs.itemToMove.value) return false

    if (isInRoot) {
      return folderDialogs.selectedMoveFolder.value !== null
    }
    return true
  } else {
    // Moving folder
    if (!folderDialogs.folderToMove.value) return false

    if (folderDialogs.selectedMoveFolder.value) {
      return !isFolderInside(
        folderDialogs.folderToMove.value,
        folderDialogs.selectedMoveFolder.value,
      )
    }

    if (isInRoot) {
      return false
    }
    return true
  }
})

// Calculate current folder depth
const currentFolderDepth = computed(() => {
  return currentFolderPath.value.length - 1 // Subtract 1 for root
})

// Check if max depth reached (3 levels)
const isMaxDepthReached = computed(() => {
  return currentFolderDepth.value >= BIBLE_CONFIG.FOLDER.MAX_DEPTH
})

const confirmMoveVerse = async (targetId: string) => {
  if (!canMoveToRoot.value) return

  const destinationId =
    targetId || folderDialogs.selectedMoveFolder.value?.id || BibleFolder.ROOT_ID
  const sourceFolderId =
    currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

  // Multi-select Move
  if (folderDialogs.moveSelection.value.size > 0) {
    const promises: Promise<void | boolean>[] = []

    // We need to handle folders and verses.
    // Iterating selection
    for (const id of folderDialogs.moveSelection.value) {
      // Check if it's a folder
      const folder = getFolderById(id)
      if (folder) {
        promises.push(moveFolderAction(folder, destinationId, sourceFolderId, false))
      } else {
        // Assume verse
        const verse = getCurrentVerses.value.find((v) => v.id === id)
        if (verse) {
          promises.push(moveItemAction(verse, destinationId, sourceFolderId))
        }
      }
    }
    await Promise.all(promises)
  } else if (moveItemType.value === 'verse') {
    if (!folderDialogs.itemToMove.value) return

    // Call store action - direct mutation
    // We need to cast itemToMove to VerseItem because openMoveDialog is generic
    await moveItemAction(folderDialogs.itemToMove.value as VerseItem, destinationId, sourceFolderId)
  } else {
    // Move folder
    if (!folderDialogs.folderToMove.value) return

    // Call store action - direct mutation
    await moveFolderAction(folderDialogs.folderToMove.value, destinationId, sourceFolderId)
  }

  // Cleanup state
  folderDialogs.showMoveDialog.value = false
  folderDialogs.itemToMove.value = null
  folderDialogs.folderToMove.value = null
  folderDialogs.selectedMoveFolder.value = null
  folderDialogs.moveSelection.value.clear()
  folderDialogs.moveBreadcrumb.value = []
}

const showMoveItemDialog = () => {
  if (!selectedItem.value || selectedItem.value.type === 'history') return

  if (selectedItem.value.type === 'verse' && isVerseItem(selectedItem.value.item)) {
    // Check for multi-select
    if (
      activeTabSelection.value.has(selectedItem.value.item.id) &&
      activeTabSelection.value.size > 0
    ) {
      folderDialogs.openMoveSelectedDialog(activeTabSelection.value)
    } else {
      showMoveDialog(selectedItem.value.item)
    }
  } else if (selectedItem.value.type === 'folder' && isFolder(selectedItem.value.item)) {
    // Check for multi-select
    if (
      activeTabSelection.value.has(selectedItem.value.item.id) &&
      activeTabSelection.value.size > 0
    ) {
      folderDialogs.openMoveSelectedDialog(activeTabSelection.value)
    } else {
      showMoveFolderDialog(selectedItem.value.item)
    }
  }
  closeItemContextMenu()
}

const handleEscape = () => {
  // 1. Close Context Menu
  closeItemContextMenu()

  // 2. Clear Selection
  if (activeTabSelection.value.size > 0) {
    if (multiFunctionTab.value === 'custom' && customFolderTabRef.value) {
      customFolderTabRef.value.clearSelection()
    } else if (multiFunctionTab.value === 'history' && historyTabRef.value) {
      historyTabRef.value.clearSelection()
    }
  }
}

const deleteItem = () => {
  // Priority 1: Multi-selection (Works for Keyboard & Context Menu if selection exists)
  if (activeTabSelection.value.size > 0) {
    batchDeleteCount.value = activeTabSelection.value.size
    folderDialogs.openDeleteSelectionDialog()
    closeItemContextMenu()
    return
  } else {
    batchDeleteCount.value = 0
  }

  // Priority 2: Single Item (Context Menu only)
  if (!selectedItem.value) return

  const itemType = selectedItem.value.type
  const item = selectedItem.value.item

  if (itemType === 'verse' && isVerseItem(item)) {
    removeFromCurrentFolder(item.id)
  } else if (itemType === 'folder' && isFolder(item)) {
    showDeleteFolderDialog(item.id)
  } else if (itemType === 'history' && isVerseItem(item)) {
    // Delete history item
    bibleStore.removeHistoryItem(item.id)
  }
  closeItemContextMenu()
}

const showFolderSettings = () => {
  if (selectedItem.value?.type === 'folder' && isFolder(selectedItem.value.item)) {
    openFolderSettings(selectedItem.value.item)
  }
}

// Keyboard Shortcuts
useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.EDIT.PASTE,
    handler: () => {
      if (multiFunctionTab.value === 'custom') {
        pasteItemHandler()
      }
    },
  },
  {
    config: KEYBOARD_SHORTCUTS.EDIT.DELETE,
    handler: deleteItem,
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ESCAPE,
    handler: handleEscape,
  },
])
</script>

<style scoped></style>
