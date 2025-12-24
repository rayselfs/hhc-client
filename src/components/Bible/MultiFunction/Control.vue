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
          <v-btn
            size="small"
            class="pa-0 text-subtitle-1"
            variant="text"
            :disabled="currentFolderPath.length === 1"
            @click="navigateToRoot()"
          >
            <v-icon class="mr-1">mdi-home</v-icon>
            {{ $t('common.homepage') }}
          </v-btn>
          <span v-for="(folderId, index) in currentFolderPath.slice(1)" :key="folderId">
            <v-icon size="x-small" class="ml-1 mr-1">mdi-chevron-right</v-icon>
            <v-btn
              size="small"
              class="pa-0 text-subtitle-1"
              variant="text"
              :disabled="index === currentFolderPath.length - 2"
              @click="handleNavigateToFolder(folderId)"
            >
              <v-icon class="mr-1">mdi-folder</v-icon>
              {{ getFolderById(folderId)?.name }}
            </v-btn>
          </span>
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

    <!-- 創建/編輯資料夾對話框 -->
    <v-dialog v-model="showFolderDialog" max-width="400">
      <v-card>
        <v-card-title>{{
          editingFolderId ? $t('fileExplorer.folderSettings') : $t('fileExplorer.newFolder')
        }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="folderName"
            :label="$t('fileExplorer.folderName')"
            :error-messages="nameErrorMessage"
            variant="outlined"
            density="compact"
            autofocus
            @keyup.enter="confirmCreateFolder"
          />

          <v-select
            v-model="retentionPeriod"
            :items="retentionOptions"
            :label="$t('fileExplorer.retentionPeriod')"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFolderDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="isDuplicateName" @click="confirmCreateFolder">{{
            editingFolderId ? $t('common.confirm') : $t('common.create')
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Move Verse Dialog -->
    <v-dialog v-model="showMoveVerseDialog" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center">
          <span class="mr-3">{{ $t('common.moveTo') }}</span>
          <!-- 資料夾路徑導航 -->
          <div class="folder-breadcrumb">
            <v-btn
              size="small"
              class="pa-0"
              variant="text"
              :disabled="moveBreadcrumb.length === 0 && !selectedMoveFolder"
              @click="navigateMoveToRoot"
            >
              <v-icon class="mr-1">mdi-home</v-icon>
              {{ $t('common.homepage') }}
            </v-btn>
            <v-icon
              v-if="moveBreadcrumb.length > 0 || selectedMoveFolder"
              size="x-small"
              class="ml-1 mr-1"
              >mdi-chevron-right</v-icon
            >
            <span v-for="(folderId, index) in moveBreadcrumb" :key="folderId">
              <v-btn
                size="small"
                class="pa-0"
                variant="text"
                :disabled="index === moveBreadcrumb.length - 1"
                @click="navigateMoveToFolder(folderId)"
              >
                <v-icon class="mr-1">mdi-folder</v-icon>
                {{ getFolderById(folderId)?.name }}
              </v-btn>
              <v-icon v-if="index < moveBreadcrumb.length - 1" size="x-small" class="ml-1 mr-1"
                >mdi-chevron-right</v-icon
              >
            </span>
          </div>
        </v-card-title>

        <v-card-text>
          <!-- 移動目標列表 -->
          <div class="move-folder-list">
            <div v-if="getMoveFolders().length === 0" class="text-center pa-4 text-grey">
              {{ $t('fileExplorer.noFolder') }}
            </div>
            <div v-else>
              <div
                v-for="target in getMoveTargets()"
                :key="target.id"
                class="verse-item pa-3 mb-2 d-flex align-center justify-space-between"
                :class="{ 'selected-target': selectedMoveFolder?.id === target.id }"
                @click="selectMoveTarget(target)"
              >
                <div class="d-flex align-center">
                  <v-icon class="mr-2">mdi-folder</v-icon>
                  <span>{{ target.name }}</span>
                </div>
                <v-icon>mdi-chevron-right</v-icon>
              </div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="showMoveVerseDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="confirmMoveVerse" :disabled="!canMoveToRoot">
            {{ $t('common.move') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 刪除資料夾確認對話框 -->
    <v-dialog v-model="showDeleteConfirmDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('common.confirmDeleteItem') }}</v-card-title>
        <v-card-text>
          <div v-if="folderToDelete" class="mt-2 text-subtitle-1">
            <v-icon class="mr-2">mdi-folder</v-icon>
            <span>{{ folderToDelete.name }}</span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteConfirmDialog = false">{{ $t('common.cancel') || 'Cancel' }}</v-btn>
          <v-btn color="error" @click="confirmDeleteFolder">{{ $t('common.delete') || 'Delete' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 右鍵選單 -->
    <ContextMenu ref="contextMenuRef" :close-on-content-click="false">
      <!-- 當選中項目時顯示：複製、移動、刪除 -->
      <template v-if="selectedItem">
        <!-- 歷史項目：只顯示複製和刪除 -->
        <template v-if="selectedItem && selectedItem.type === 'history'">
          <v-list-item @click="copyItem">
            <template #prepend>
              <v-icon>mdi-content-copy</v-icon>
            </template>
            <v-list-item-title>{{ $t('common.copy') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="deleteItem">
            <template #prepend>
              <v-icon>mdi-delete</v-icon>
            </template>
            <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
          </v-list-item>
        </template>

        <!-- 自訂項目（經文/資料夾）：顯示複製、移動、刪除 -->
        <template v-else>
          <v-list-item @click="copyItem">
            <template #prepend>
              <v-icon>mdi-content-copy</v-icon>
            </template>
            <v-list-item-title>{{ $t('common.copy') }}</v-list-item-title>
          </v-list-item>

          <v-list-item @click="showMoveItemDialog">
            <template #prepend>
              <v-icon>mdi-folder-move</v-icon>
            </template>
            <v-list-item-title>{{ $t('common.move') }}</v-list-item-title>
          </v-list-item>

          <v-list-item @click="showFolderSettings()">
            <template #prepend>
              <v-icon>mdi-cog</v-icon>
            </template>
            <v-list-item-title>{{ $t('common.edit') }}</v-list-item-title>
          </v-list-item>

          <v-list-item @click="deleteItem">
            <template #prepend>
              <v-icon>mdi-delete</v-icon>
            </template>
            <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
          </v-list-item>
        </template>
      </template>

      <!-- 當沒有選中項目但有複製內容時，在 custom 頁面顯示：貼上 -->
      <template v-else-if="copiedItem && multiFunctionTab === 'custom'">
        <v-list-item @click="pasteItemHandler">
          <template #prepend>
            <v-icon>mdi-content-paste</v-icon>
          </template>
          <v-list-item-title>{{ $t('common.paste') }}</v-list-item-title>
        </v-list-item>
      </template>

      <!-- 當沒有選中項目且沒有複製內容時，在 custom 頁面顯示：新資料夾 -->
      <template v-else-if="multiFunctionTab === 'custom'">
        <v-list-item @click="createNewFolder">
          <template #prepend>
            <v-icon>mdi-folder-plus</v-icon>
          </template>
          <v-list-item-title>{{ $t('fileExplorer.newFolder') }}</v-list-item-title>
        </v-list-item>
      </template>
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
import { useBibleStore } from '@/stores/bible'
import { useBible } from '@/composables/useBible'
import { isVerseItem, isFolder, type DragData } from '@/utils/typeGuards'
import ContextMenu from '@/components/ContextMenu.vue'
import HistoryTab from './HistoryTab.vue'
import CustomFolderTab from './CustomFolderTab.vue'
import { APP_CONFIG } from '@/config/app'

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
const { folderStore } = useBible()

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
const showFolderDialog = ref(false)
const folderName = ref('')
const retentionPeriod = ref('1day') // Default to 1 day
const editingFolderId = ref<string | null>(null) // Track if we are editing a folder

const retentionOptions = computed(() => [
  { title: $t('fileExplorer.retention.1day'), value: '1day' },
  { title: $t('fileExplorer.retention.1week'), value: '1week' },
  { title: $t('fileExplorer.retention.1month'), value: '1month' },
  { title: $t('fileExplorer.retention.permanent'), value: 'permanent' },
])

// Check for duplicate folder name
const isDuplicateName = computed(() => {
  if (!folderName.value.trim()) return false
  return currentFolder.value.folders.some((f) => {
    // If editing, exclude self from check
    if (editingFolderId.value && f.id === editingFolderId.value) {
      return false
    }
    return f.name === folderName.value.trim()
  })
})

const nameErrorMessage = computed(() => {
  if (isDuplicateName.value) {
    return $t('fileExplorer.duplicateFolderName')
  }
  return ''
})

// 監聽頁面切換，切換到 custom 時重置到 root
watch(multiFunctionTab, (newTab) => {
  if (newTab === 'custom') {
    navigateToRoot()
  }
})

// 右鍵選單相關
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)

const selectedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: VerseItem | Folder<VerseItem>
} | null>(null)

// 複製/貼上相關
const copiedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: VerseItem | Folder<VerseItem>
} | null>(null)

// 移動相關狀態
const showMoveVerseDialog = ref(false)
const moveBreadcrumb = ref<string[]>([])
const selectedMoveFolder = ref<Folder<VerseItem> | null>(null)
const verseToMove = ref<VerseItem | null>(null)
const folderToMove = ref<Folder<VerseItem> | null>(null)
const moveItemType = ref<'verse' | 'folder'>('verse') // 區分移動類型

// 刪除確認對話框狀態
const showDeleteConfirmDialog = ref(false)
const folderToDelete = ref<Folder<VerseItem> | null>(null)

const loadVerse = (item: VerseItem, type: 'history' | 'custom') => {
  emit('load-verse', item, type)
}

// 自訂資料夾相關函數
const createNewFolder = () => {
  folderName.value = ''
  retentionPeriod.value = '1day' // Reset to default
  editingFolderId.value = null // Reset edit mode
  showFolderDialog.value = true
  closeItemContextMenu()
}

const openFolderSettings = (folder: Folder<VerseItem>) => {
  folderName.value = folder.name
  editingFolderId.value = folder.id

  // Set retention period based on expiresAt
  if (folder.expiresAt === null || folder.expiresAt === undefined) {
    retentionPeriod.value = 'permanent'
  } else {
    // Calculate approximate retention period
    const diff = folder.expiresAt - folder.timestamp // Use creation time to determine original setting
    const oneDay = 24 * 60 * 60 * 1000

    // Simple heuristic mapping
    if (diff > oneDay * 25) {
      retentionPeriod.value = '1month'
    } else if (diff > oneDay * 6) {
      retentionPeriod.value = '1week'
    } else {
      retentionPeriod.value = '1day'
    }
  }

  showFolderDialog.value = true
  closeItemContextMenu()
}

const confirmCreateFolder = () => {
  if (folderName.value.trim() && !isDuplicateName.value) {
    let expiresAt: number | null = null
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    switch (retentionPeriod.value) {
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

    if (editingFolderId.value) {
      // Update existing folder
      updateFolder(editingFolderId.value, {
        name: folderName.value,
        expiresAt: expiresAt,
      })
    } else {
      // Create new folder
      addFolderToCurrent(folderName.value, expiresAt)
    }

    showFolderDialog.value = false
    folderName.value = ''
    editingFolderId.value = null
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
    folderToDelete.value = folder
    showDeleteConfirmDialog.value = true
  }
}

const confirmDeleteFolder = () => {
  if (folderToDelete.value) {
    // Call store action - direct mutation
    deleteFolderAction(folderToDelete.value.id)
    showDeleteConfirmDialog.value = false
    folderToDelete.value = null
  }
}

const removeFromCurrentFolder = (itemId: string) => {
  // Call store action - direct mutation
  removeItemFromCurrent(itemId)
}

// 處理拖放到資料夾
const handleDropToFolder = (data: DragData<VerseItem>, targetFolder: Folder<VerseItem>) => {
  if (data.type === 'verse' && isVerseItem(data.item)) {
    moveVerseToFolder(data.item, targetFolder)
  } else if (data.type === 'folder' && isFolder(data.item)) {
    moveFolderToFolder(data.item, targetFolder)
  }
}

// Move verse to folder (drag & drop)
const moveVerseToFolder = (verse: VerseItem, targetFolder: Folder<VerseItem>) => {
  const sourceFolderId =
    currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentFolder.value.id
  // Call store action - direct mutation
  moveItemAction(verse, targetFolder.id, sourceFolderId)
}

// Move folder to another folder (drag & drop)
const moveFolderToFolder = (folderToMove: Folder<VerseItem>, targetFolder: Folder<VerseItem>) => {
  const sourceFolderId =
    currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentFolder.value.id
  // Call store action - direct mutation
  moveFolderAction(folderToMove, targetFolder.id, sourceFolderId)
}

// Move verse related functions
const showMoveDialog = (item: VerseItem) => {
  verseToMove.value = item
  folderToMove.value = null
  moveItemType.value = 'verse'
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
  showMoveVerseDialog.value = true
}

// 移動資料夾相關函數
const showMoveFolderDialog = (item: Folder<VerseItem>) => {
  folderToMove.value = item
  verseToMove.value = null
  moveItemType.value = 'folder'
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
  showMoveVerseDialog.value = true
}

const navigateMoveToRoot = () => {
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
}

const navigateMoveToFolder = (folderId: string) => {
  const folder = getFolderById(folderId)
  if (folder) {
    const index = moveBreadcrumb.value.indexOf(folderId)
    const newPath = index !== -1 ? moveBreadcrumb.value.slice(0, index + 1) : moveBreadcrumb.value
    moveBreadcrumb.value = newPath
    selectedMoveFolder.value = folder
  }
}

const selectMoveTarget = (target: Folder<VerseItem>) => {
  // 選擇資料夾
  const folder = getFolderById(target.id)
  if (folder) {
    // 將資料夾添加到麵包屑中
    moveBreadcrumb.value = [...moveBreadcrumb.value, target.id]
    selectedMoveFolder.value = folder
  }
}

const getMoveFolders = (): Folder<VerseItem>[] => {
  const excludeFolderId =
    moveItemType.value === 'folder' && folderToMove.value ? folderToMove.value.id : undefined
  return getMoveTargets(selectedMoveFolder.value, excludeFolderId)
}

// Check if can move to root
const canMoveToRoot = computed(() => {
  if (moveItemType.value === 'verse') {
    if (!verseToMove.value) return false

    const isInRoot = currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
    if (isInRoot) {
      return selectedMoveFolder.value !== null
    }
    return true
  } else {
    // Moving folder
    if (!folderToMove.value) return false

    if (selectedMoveFolder.value) {
      return !isFolderInside(folderToMove.value, selectedMoveFolder.value)
    }

    const isInRoot = currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
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
  return currentFolderDepth.value >= APP_CONFIG.FOLDER.MAX_DEPTH
})

const confirmMoveVerse = () => {
  if (!canMoveToRoot.value) return

  if (moveItemType.value === 'verse') {
    if (!verseToMove.value) return

    const sourceFolderId =
      currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
        ? APP_CONFIG.FOLDER.ROOT_ID
        : currentFolder.value.id
    const targetFolderId = selectedMoveFolder.value
      ? selectedMoveFolder.value.id
      : APP_CONFIG.FOLDER.ROOT_ID

    // Call store action - direct mutation
    moveItemAction(verseToMove.value, targetFolderId || APP_CONFIG.FOLDER.ROOT_ID, sourceFolderId)
  } else {
    // Move folder
    if (!folderToMove.value) return

    const sourceFolderId =
      currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
        ? APP_CONFIG.FOLDER.ROOT_ID
        : currentFolder.value.id
    const targetFolderId = selectedMoveFolder.value
      ? selectedMoveFolder.value.id
      : APP_CONFIG.FOLDER.ROOT_ID

    // Call store action - direct mutation
    moveFolderAction(
      folderToMove.value,
      targetFolderId || APP_CONFIG.FOLDER.ROOT_ID,
      sourceFolderId,
    )
  }

  // Cleanup state
  showMoveVerseDialog.value = false
  verseToMove.value = null
  folderToMove.value = null
  selectedMoveFolder.value = null
  moveBreadcrumb.value = []
  moveItemType.value = 'verse'
}

// 右鍵選單處理函數
const handleRightClick = (
  event: MouseEvent,
  type: 'verse' | 'folder' | 'history',
  item: VerseItem | Folder<VerseItem>,
) => {
  selectedItem.value = { type, item }
  contextMenuRef.value?.open(event)
}

// 處理 v-card-text 的右鍵點擊
const handleCardTextRightClick = (event: MouseEvent) => {
  // 如果右鍵點擊的是經文或資料夾，不處理
  if ((event.target as HTMLElement).closest('.verse-item')) {
    return
  }

  selectedItem.value = null // 清空選中的項目
  contextMenuRef.value?.open(event)
}

const closeItemContextMenu = () => {
  contextMenuRef.value?.close()
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
    currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentFolder.value.id

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
