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
        <!-- 資料夾路徑導航 -->
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
        :has-clipboard="!!copiedItem"
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
} = folderStore

// 狀態
const multiFunctionTab = ref('history')
const folderDialogs = useFolderDialogs<VerseItem>()

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

// Use folderDialogs.moveBreadcrumb directly. It is already {id, name}[]
const moveBreadcrumbItems = computed(() => {
  // If empty, start with root? useFolderDialogs might handle this differently,
  // but in Control.vue we want explicit Root at start if it's not seemingly there,
  // OR we trust `moveBreadcrumb` to contain what we need.
  // `useFolderDialogs` initializes specific breadcrumbs in openMoveDialog.
  // Let's rely on `folderDialogs.moveBreadcrumb` being correct.
  // However, existing MoveFolderDialog expects {id, name}[].
  // folderDialogs.moveBreadcrumb IS {id, name}[].
  return folderDialogs.moveBreadcrumb.value
})

// 監聽頁面切換，切換到 custom 時重置到 root
watch(multiFunctionTab, (newTab) => {
  if (newTab === 'custom') {
    navigateToRoot()
  }
})

// 右鍵選單相關
const showItemContextMenu = ref(false)
const showBackgroundContextMenu = ref(false)
const menuPosition = ref<[number, number] | undefined>(undefined)

const selectedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: VerseItem | Folder<VerseItem>
} | null>(null)

// 複製/貼上相關
const copiedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: VerseItem | Folder<VerseItem>
} | null>(null)

// 移動相關狀態 (Derived from folderDialogs)
const moveItemType = computed(() => {
  if (folderDialogs.folderToMove.value) return 'folder'
  if (folderDialogs.itemToMove.value) return 'verse'
  return 'verse' // Default
})

const loadVerse = (item: VerseItem, type: 'history' | 'custom') => {
  emit('load-verse', item, type)
}

// 自訂資料夾相關函數
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

  // Custom logic for retention period calculation based on expiresAt
  // `useFolderDialogs` sets default '1day' or existing value.
  // We need to map `expiresAt` back to retentionPeriod string if it's not just a string in Folder.
  // Wait, `Folder` type has `retentionPeriod`? No, it has `expiresAt`.
  // `useFolderDialogs` logic for `openEditDialog` sets `folderName` and `editingFolderId`.
  // It does NOT automatically map `expiresAt` to `retentionPeriod` because `Folder` type is generic.
  // So we strictly need to do this mapping HERE after opening the dialog.

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

// 處理拖放到資料夾
const handleDropToFolder = (data: DragData<VerseItem>, targetFolder: Folder<VerseItem>) => {
  const item = data.items[0]
  if (data.type === 'verse' && isVerseItem(item)) {
    moveVerseToFolder(item as VerseItem, targetFolder)
  } else if (data.type === 'folder' && isFolder(item)) {
    moveFolderToFolder(item as Folder<VerseItem>, targetFolder)
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

// 移動資料夾相關函數
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
  if (moveItemType.value === 'verse') {
    if (!folderDialogs.itemToMove.value) return false

    const isInRoot = currentFolder.value.id === BibleFolder.ROOT_ID
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

    const isInRoot = currentFolder.value.id === BibleFolder.ROOT_ID
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

// 判斷是否達到最大深度（3層）
const isMaxDepthReached = computed(() => {
  return currentFolderDepth.value >= BIBLE_CONFIG.FOLDER.MAX_DEPTH
})

const confirmMoveVerse = (targetId: string) => {
  if (!canMoveToRoot.value) return

  const destinationId =
    targetId || folderDialogs.selectedMoveFolder.value?.id || BibleFolder.ROOT_ID

  if (moveItemType.value === 'verse') {
    if (!folderDialogs.itemToMove.value) return

    const sourceFolderId =
      currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

    // Call store action - direct mutation
    // We need to cast itemToMove to VerseItem because openMoveDialog is generic
    moveItemAction(folderDialogs.itemToMove.value as VerseItem, destinationId, sourceFolderId)
  } else {
    // Move folder
    if (!folderDialogs.folderToMove.value) return

    const sourceFolderId =
      currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

    // Call store action - direct mutation
    moveFolderAction(folderDialogs.folderToMove.value, destinationId, sourceFolderId)
  }

  // Cleanup state
  folderDialogs.showMoveDialog.value = false
  folderDialogs.itemToMove.value = null
  folderDialogs.folderToMove.value = null
  folderDialogs.selectedMoveFolder.value = null
  folderDialogs.moveBreadcrumb.value = []
}

// 右鍵選單處理函數
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

// 處理 v-card-text 的右鍵點擊
const handleCardTextRightClick = (event: MouseEvent) => {
  // 如果右鍵點擊的是經文或資料夾，不處理
  if ((event.target as HTMLElement).closest('.verse-item')) {
    return
  }

  event.preventDefault()
  selectedItem.value = null // 清空選中的項目
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
  if (selectedItem.value) {
    copiedItem.value = selectedItem.value
  }
  closeItemContextMenu()
}

const pasteItemHandler = () => {
  if (!copiedItem.value) return

  const targetFolderId =
    currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

  if (copiedItem.value.type === 'verse' && isVerseItem(copiedItem.value.item)) {
    // Paste verse
    pasteItem(copiedItem.value.item, targetFolderId, 'verse')
  } else if (copiedItem.value.type === 'folder' && isFolder(copiedItem.value.item)) {
    // Paste folder
    pasteItem(copiedItem.value.item, targetFolderId, 'folder')
  } else if (copiedItem.value.type === 'history' && isVerseItem(copiedItem.value.item)) {
    // Paste history item as verse
    pasteItem(copiedItem.value.item, targetFolderId, 'verse')
  }
  closeItemContextMenu()
}

const showMoveItemDialog = () => {
  if (!selectedItem.value) return

  if (selectedItem.value.type === 'verse' && isVerseItem(selectedItem.value.item)) {
    // 使用現有的移動功能
    showMoveDialog(selectedItem.value.item)
  } else if (selectedItem.value.type === 'folder' && isFolder(selectedItem.value.item)) {
    // 資料夾移動功能
    showMoveFolderDialog(selectedItem.value.item)
  } else if (selectedItem.value.type === 'history') {
    // 歷史項目不能移動，這個函數不應該被調用
    console.warn('History items cannot be moved')
  }
  closeItemContextMenu()
}

const deleteItem = () => {
  if (!selectedItem.value) return

  if (selectedItem.value.type === 'verse' && isVerseItem(selectedItem.value.item)) {
    removeFromCurrentFolder(selectedItem.value.item.id)
  } else if (selectedItem.value.type === 'folder' && isFolder(selectedItem.value.item)) {
    showDeleteFolderDialog(selectedItem.value.item.id)
  } else if (selectedItem.value.type === 'history' && isVerseItem(selectedItem.value.item)) {
    // 刪除歷史項目
    bibleStore.removeHistoryItem(selectedItem.value.item.id)
  }
  closeItemContextMenu()
}

const showFolderSettings = () => {
  if (selectedItem.value?.type === 'folder' && isFolder(selectedItem.value.item)) {
    openFolderSettings(selectedItem.value.item)
  }
}
</script>

<style scoped>
.verse-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 4px;
  user-select: none; /* 防止文字選擇 */
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.verse-item.drag-over {
  background-color: rgba(var(--v-theme-primary), 0.2) !important;
  border: 2px dashed rgba(var(--v-theme-primary), 0.5);
}

.selected-target {
  background-color: rgba(var(--v-theme-primary), 0.15) !important;
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}
</style>
