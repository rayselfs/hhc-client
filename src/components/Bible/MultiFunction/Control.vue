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
import type { VerseItem, Folder } from '@/types/folder'
import { useBibleFolderStore } from '@/stores/folder'
import { useBibleStore } from '@/stores/bible'
import { isVerseItem, isFolder, type DragData } from '@/utils/typeGuards'
import ContextMenu from '@/components/Shared/ContextMenu.vue'
import { BibleBackgroundContextMenu, BibleVerseContextMenu } from '@/components/Bible'
import HistoryTab from './HistoryTab.vue'
import CustomFolderTab from './CustomFolderTab.vue'
import FolderBreadcrumbs from '@/components/Shared/FolderBreadcrumbs.vue'
import MoveFolderDialog from '@/components/Shared/MoveFolderDialog.vue'
import CreateEditFolderDialog from '@/components/Shared/CreateEditFolderDialog.vue'
import DeleteConfirmDialog from '@/components/Shared/DeleteConfirmDialog.vue'
import { useBibleExport } from '@/composables/bible/useBibleExport'
import { useBibleContextMenu } from '@/composables/bible/useBibleContextMenu'
import { useBibleClipboard } from '@/composables/bible/useBibleClipboard'
import { useBibleFolderDialogs } from '@/composables/bible/useBibleFolderDialogs'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import { BibleFolder } from '@/types/enum'

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
  removeItemFromCurrent,
  moveItem: moveItemAction,
  moveFolder: moveFolderAction,
  pasteItem,
  getFolderById,
  isFolderInside,
  updateFolder,
  copyToClipboard,
  hasClipboardItems,
  clearClipboard,
} = folderStore

// Status
const multiFunctionTab = ref('history')
const activeTabSelection = ref<Set<string>>(new Set())
const customSelectedItems = ref<Set<string>>(new Set())

const handleSelectionChange = (selection: Set<string>) => {
  activeTabSelection.value = selection
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

// Folder Dialogs Logic (extracted to composable)
const {
  folderDialogs,
  batchDeleteCount,
  isDuplicateName,
  nameErrorMessage,
  isMaxDepthReached,
  createNewFolder,
  confirmCreateFolder,
  confirmDeleteFolder,
  confirmMoveVerse,
  handleMoveNavigate,
  showMoveItemDialog,
  deleteItem,
  showFolderSettings,
  getMoveFolders,
  showDeleteFolderDialog,
} = useBibleFolderDialogs({
  currentFolder,
  currentFolderPath,
  activeTabSelection,
  multiFunctionTab,
  selectedItem,
  closeItemContextMenu,
  removeFromCurrentFolder: removeItemFromCurrent,
})

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

const loadVerse = (item: VerseItem, type: 'history' | 'custom') => {
  emit('load-verse', item, type)
}

// Navigation functions (now use store actions)
const handleNavigateToFolder = (folderId: string) => {
  navigateToFolder(folderId)
}

const handleEnterFolder = (folderId: string) => {
  enterFolder(folderId)
}

const removeFromCurrentFolder = (itemId: string) => {
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
  moveItemAction(verse, targetFolder.id, sourceFolderId)
}

// Move folder to another folder (drag & drop)
const moveFolderToFolder = (folderToMove: Folder<VerseItem>, targetFolder: Folder<VerseItem>) => {
  const sourceFolderId =
    currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id
  moveFolderAction(folderToMove, targetFolder.id, sourceFolderId)
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
