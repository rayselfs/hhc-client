<template>
  <v-card :style="{ height: props.containerHeight ? `${props.containerHeight}px` : '100%' }">
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

const handleSelectionChange = (selection: Set<string>) => {
  activeTabSelection.value = selection
  // Also sync custom specific logic (ensure export still works with customSelectedItems)
  customSelectedItems.value = selection
}

const customFolderTabRef = ref<InstanceType<typeof CustomFolderTab> | null>(null)
const historyTabRef = ref<InstanceType<typeof HistoryTab> | null>(null)

// Export Disable Logic
const isExportDisabled = computed(() => {
  if (multiFunctionTab.value === 'history') {
    return historyVerses.value.length === 0
  } else {
    return customSelectedItems.value.size === 0 && getCurrentVerses.value.length === 0
  }
})

// Export Logic
const handleExport = async () => {
  interface ExportGroup {
    name: string
    verses: VerseItem[]
  }

  const groups: ExportGroup[] = []

  if (multiFunctionTab.value === 'history') {
    if (historyVerses.value.length > 0) {
      groups.push({
        name: 'history',
        verses: historyVerses.value,
      })
    }
  } else {
    // Custom Tab
    if (customSelectedItems.value.size > 0) {
      // Export selected items (Folders + Verses)
      const selectedFolderIds: string[] = []
      const selectedVerseIds: string[] = []

      customSelectedItems.value.forEach((id) => {
        let folder = getFolderById(id) // Helper from store

        // Fallback: If store lookup fails, check current visible folders
        if (!folder) {
          const found = getCurrentFolders.value.find((f: Folder<VerseItem>) => f.id === id)
          if (found) folder = found
        }

        if (folder) {
          selectedFolderIds.push(id)
        } else {
          // Assume verse if not folder
          selectedVerseIds.push(id)
        }
      })

      // Handle Selected Folders
      for (const folderId of selectedFolderIds) {
        let folder = getFolderById(folderId)
        if (!folder) {
          const found = getCurrentFolders.value.find((f: Folder<VerseItem>) => f.id === folderId)
          if (found) folder = found
        }

        if (folder) {
          const folderVerses = await collectVersesFromFolder(folder)
          if (folderVerses.length > 0) {
            groups.push({
              name: folder.name,
              verses: folderVerses,
            })
          }
        }
      }

      // Handle Selected Verses (that are in current view)
      // We filter getCurrentVerses to find the selected ones
      const selectedVersesInView = getCurrentVerses.value.filter((v: VerseItem) =>
        customSelectedItems.value.has(v.id),
      )
      if (selectedVersesInView.length > 0) {
        groups.push({
          name: currentFolder.value?.name || '首頁', // Use '首頁' for root
          verses: selectedVersesInView,
        })
      }
    } else {
      // Export Current Folder Content (No selection)
      if (getCurrentVerses.value.length > 0) {
        groups.push({
          name: currentFolder.value?.name || '首頁',
          verses: getCurrentVerses.value,
        })
      }
    }
  }

  if (groups.length === 0) return

  const textContent = generateExportText(groups)
  // Format: YYYYMMDD
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  // Determine filename based on selection
  let prefix = multiFunctionTab.value
  if (multiFunctionTab.value === 'custom') {
    if (customSelectedItems.value.size > 0) {
      prefix = 'custom-selected'
    } else {
      prefix = currentFolder.value?.name ? `custom-${currentFolder.value.name}` : 'custom-root'
    }
  }

  const filename = `bible-export-${prefix}-${timestamp}.txt`
  downloadFile(textContent, filename)
}

// Helper: Recursively collect verses from a folder
const collectVersesFromFolder = async (folder: Folder<VerseItem>): Promise<VerseItem[]> => {
  let verses: VerseItem[] = [...(folder.items || [])]

  // If folder is not fully loaded, we might need to load it (if it was lazy loaded from sync/cloud)
  // For local folders, structure is already in memory.

  if (folder.folders && folder.folders.length > 0) {
    for (const subFolder of folder.folders) {
      const subVerses = await collectVersesFromFolder(subFolder)
      verses = [...verses, ...subVerses]
    }
  }
  return verses
}

// Helper: Generate Text
const generateExportText = (groups: { name: string; verses: VerseItem[] }[]) => {
  return groups
    .map((group) => {
      const header = `[${group.name === BibleFolder.ROOT_NAME ? '首頁' : group.name}]`
      const content = group.verses
        .map((v) => ` - ${v.verseText} - ${v.bookAbbreviation}${v.chapter}:${v.verse}`)
        .join('\n')
      return `${header}\n${content}`
    })
    .join('\n\n')
}

// Helper: Download File
const downloadFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

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

// Context Menu State
const showItemContextMenu = ref(false)
const showBackgroundContextMenu = ref(false)
const menuPosition = ref<[number, number] | undefined>(undefined)

const selectedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: VerseItem | Folder<VerseItem>
} | null>(null)

import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

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
  if (folderDialogs.folderToDelete.value) {
    // Call store action - direct mutation
    deleteFolderAction(folderDialogs.folderToDelete.value.id)
    folderDialogs.showDeleteConfirmDialog.value = false
    folderDialogs.folderToDelete.value = null
  }
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

// Handle Right Click
const handleRightClick = (
  event: MouseEvent,
  type: 'verse' | 'folder' | 'history',
  item: VerseItem | Folder<VerseItem>,
) => {
  event.preventDefault()
  event.stopPropagation()
  selectedItem.value = { type, item }
  menuPosition.value = [event.clientX, event.clientY]
  showBackgroundContextMenu.value = false
  showItemContextMenu.value = true
}

// Handle background right click
const handleCardTextRightClick = (event: MouseEvent) => {
  // Ignore if clicking on verse or folder item
  if ((event.target as HTMLElement).closest('.verse-item')) {
    return
  }

  event.preventDefault()
  selectedItem.value = null // Clear selection
  menuPosition.value = [event.clientX, event.clientY]
  showItemContextMenu.value = false
  showBackgroundContextMenu.value = true
}

const closeItemContextMenu = () => {
  showItemContextMenu.value = false
  showBackgroundContextMenu.value = false
  selectedItem.value = null
}

const copyItem = () => {
  if (!selectedItem.value) return

  const isSelected = activeTabSelection.value.has(selectedItem.value.item.id)
  if (isSelected) {
    if (multiFunctionTab.value === 'custom' && customFolderTabRef.value) {
      customFolderTabRef.value.copySelectedItems()
      closeItemContextMenu()
      return
    } else if (multiFunctionTab.value === 'history' && historyTabRef.value) {
      historyTabRef.value.copySelectedItems()
      closeItemContextMenu()
      return
    }
  }

  // Fallback to single item copy
  const item = selectedItem.value.item

  // Custom/History Single Item
  const type = isFolder(item) ? 'folder' : 'verse'
  const sourceFolderId =
    selectedItem.value.type === 'history'
      ? BibleFolder.ROOT_ID
      : currentFolder.value?.id || BibleFolder.ROOT_ID

  copyToClipboard([
    {
      type: type,
      data: item,
      action: 'copy',
      sourceFolderId,
    },
  ])
  closeItemContextMenu()
}

const pasteItemHandler = async () => {
  if (!hasClipboardItems()) return

  const targetFolderId =
    currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

  let movedCount = 0

  for (const item of clipboard.value) {
    const data = item.data

    // Check if it's a verse or file type in clipboard
    if (item.type === 'file' || item.type === 'verse') {
      // Must be a VerseItem to paste into Bible Custom Folder
      if (isVerseItem(data)) {
        if (item.action === 'cut') {
          await moveItemAction(data as VerseItem, targetFolderId, item.sourceFolderId)
          movedCount++
        } else {
          pasteItem(data as VerseItem, targetFolderId, 'verse')
        }
      } else {
        // It's a media file (FileItem) - Skip or Warn
      }
    } else if (item.type === 'folder') {
      // Logic for folder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const folder = data as Folder<any>
      // Check content of folder to ensure compatibility
      const isValidFolder =
        (folder.items && folder.items.length > 0 && isVerseItem(folder.items[0])) ||
        !folder.items ||
        folder.items.length === 0

      if (isValidFolder) {
        if (item.action === 'cut') {
          // Move folder
          await moveFolderAction(
            data as Folder<VerseItem>,
            targetFolderId,
            item.sourceFolderId,
            false,
          ) // false = don't skip save
          movedCount++
        } else {
          // Paste (Clone) folder
          pasteItem(data as Folder<VerseItem>, targetFolderId, 'folder')
        }
      }
    }
  }

  // Clear clipboard if any item was moved (Cut operation completed)
  if (movedCount > 0) {
    clearClipboard()
  }

  closeItemContextMenu()
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

const deleteItem = () => {
  if (!selectedItem.value) return

  // Check selection
  const isSelected = activeTabSelection.value.has(selectedItem.value.item.id)

  if (isSelected) {
    // Delegate to child
    if (multiFunctionTab.value === 'custom' && customFolderTabRef.value) {
      customFolderTabRef.value.deleteSelectedItems()
      closeItemContextMenu()
      return
    } else if (multiFunctionTab.value === 'history' && historyTabRef.value) {
      historyTabRef.value.deleteSelectedItems()
      closeItemContextMenu()
      return
    }
  }

  if (selectedItem.value.type === 'verse' && isVerseItem(selectedItem.value.item)) {
    removeFromCurrentFolder(selectedItem.value.item.id)
  } else if (selectedItem.value.type === 'folder' && isFolder(selectedItem.value.item)) {
    showDeleteFolderDialog(selectedItem.value.item.id)
  } else if (selectedItem.value.type === 'history' && isVerseItem(selectedItem.value.item)) {
    // Delete history item
    bibleStore.removeHistoryItem(selectedItem.value.item.id)
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
    config: KEYBOARD_SHORTCUTS.MEDIA.ESCAPE,
    handler: closeItemContextMenu,
  },
])
</script>

<style scoped></style>
