<template>
  <v-card :style="{ height: props.containerHeight ? `${props.containerHeight}px` : '100%' }">
    <v-card-title class="d-flex align-center justify-space-between pa-0">
      <div class="d-flex align-center">
        <v-btn-toggle v-model="multiFunctionTab" mandatory class="rounded-0 border-e-sm">
          <v-btn value="history" size="small" :title="$t('history')">
            <v-icon size="x-large">mdi-history</v-icon>
          </v-btn>
          <v-btn value="custom" size="small" :title="$t('custom')">
            <v-icon size="x-large">mdi-folder</v-icon>
          </v-btn>
        </v-btn-toggle>
        <!-- 資料夾路徑導航 -->
        <div v-if="multiFunctionTab === 'custom'" class="ml-3">
          <v-btn
            size="small"
            class="pa-0 text-subtitle-1"
            variant="text"
            :disabled="!currentFolder"
            @click="navigateToRoot()"
          >
            <v-icon class="mr-1">mdi-home</v-icon>
            {{ $t('homepage') }}
          </v-btn>
          <v-icon v-if="currentFolderPath.length > 1" size="x-small" class="ml-1 mr-1"
            >mdi-chevron-right</v-icon
          >
          <span v-for="(folderId, index) in currentFolderPath.slice(1)" :key="folderId">
            <v-btn
              size="small"
              class="pa-0 text-subtitle-1"
              variant="text"
              :disabled="index === currentFolderPath.length - 1"
              @click="handleNavigateToFolder(folderId)"
            >
              <v-icon class="mr-1">mdi-folder</v-icon>
              {{ getFolderById(folderId)?.name }}
            </v-btn>
            <v-icon v-if="index < currentFolderPath.length - 1" size="x-small" class="ml-1 mr-1"
              >mdi-chevron-right</v-icon
            >
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
          :title="$t('delete')"
        >
          <v-icon>mdi-delete-sweep</v-icon>
        </v-btn>
        <v-btn
          v-if="multiFunctionTab === 'custom'"
          variant="text"
          icon
          @click="createNewFolder"
          :disabled="isMaxDepthReached"
          :title="$t('newFolder')"
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
      <div v-if="multiFunctionTab === 'history'" class="history-content" style="height: 100%">
        <div v-if="historyVerses.length === 0" class="text-center pa-4 text-grey">
          {{ $t('bible.noHistory') }}
        </div>
        <v-virtual-scroll
          v-else
          :items="historyVerses"
          :height="props.containerHeight ? `${props.containerHeight - 48}px` : 'calc(100% - 48px)'"
          :item-height="80"
        >
          <template #default="{ item }">
            <div
              class="verse-item pa-3 d-flex align-center justify-space-between"
              @click="loadVerse(item, 'history')"
              @contextmenu="handleRightClick($event, 'history', item)"
            >
              <div>
                <div class="text-h6 font-weight-medium d-flex">
                  <span class="mr-1 text-no-wrap"
                    >{{ item.bookAbbreviation }}{{ item.chapter }}:{{ item.verse }} -
                  </span>
                  <span class="text-justify">{{ item.verseText }}</span>
                </div>
              </div>
              <v-btn
                class="verse-btn"
                icon
                size="small"
                variant="text"
                @click.stop="removeHistoryItem(item.id)"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>
          </template>
        </v-virtual-scroll>
      </div>

      <!-- Custom Page -->
      <div v-else class="custom-content">
        <div class="custom-list">
          <div
            v-if="getCurrentFolders.length === 0 && getCurrentVerses.length === 0"
            class="text-center pa-4 text-grey"
          >
            {{ $t('noCustomItems') }}
          </div>
          <div v-else>
            <!-- 資料夾列表 -->
            <div v-for="folder in getCurrentFolders" :key="folder.id" class="mb-2">
              <div
                class="verse-item pa-2 d-flex align-center justify-space-between"
                draggable="true"
                @dragstart="handleDragStart($event, 'folder', folder)"
                @dragover="handleDragOver"
                @dragenter="handleDragEnter"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, folder)"
                @dblclick="handleEnterFolder(folder.id)"
                @contextmenu="handleRightClick($event, 'folder', folder)"
              >
                <div class="d-flex align-center text-subtitle-1">
                  <v-icon class="mr-2">mdi-folder</v-icon>
                  <span>{{ folder.name }}</span>
                </div>
                <v-btn
                  class="verse-btn"
                  icon
                  size="small"
                  variant="text"
                  @click.stop="showDeleteFolderDialog(folder.id)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
            </div>

            <!-- 經文列表 -->
            <div
              v-for="item in getCurrentVerses"
              :key="item.id"
              class="verse-item pa-2 mb-1 d-flex align-center justify-space-between"
              draggable="true"
              @dragstart="handleDragStart($event, 'verse', item)"
              @click="loadVerse(item, 'custom')"
              @contextmenu="handleRightClick($event, 'verse', item)"
            >
              <div>
                <div class="text-h6 font-weight-medium d-flex">
                  <span class="mr-1 text-no-wrap"
                    >{{ item.bookAbbreviation }}{{ item.chapter }}:{{ item.verse }} -
                  </span>
                  <span class="text-justify">{{ item.verseText }}</span>
                </div>
              </div>
              <v-btn
                class="verse-btn"
                icon
                size="small"
                variant="text"
                @click.stop="removeFromCurrentFolder(item.id)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </div>
    </v-card-text>

    <!-- 創建資料夾對話框 -->
    <v-dialog v-model="showFolderDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('newFolder') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="folderName"
            :label="$t('enterFolderName') || 'Enter folder name'"
            variant="outlined"
            autofocus
            @keyup.enter="confirmCreateFolder"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFolderDialog = false">{{ $t('cancel') || 'Cancel' }}</v-btn>
          <v-btn color="primary" @click="confirmCreateFolder">{{ $t('create') || 'Create' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Move Verse Dialog -->
    <v-dialog v-model="showMoveVerseDialog" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center">
          <span class="mr-3">{{ $t('moveTo') }}</span>
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
              {{ $t('homepage') }}
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
              {{ $t('noFolder') }}
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
          <v-btn @click="showMoveVerseDialog = false">{{ $t('cancel') || 'Cancel' }}</v-btn>
          <v-btn color="primary" @click="confirmMoveVerse" :disabled="!canMoveToRoot">
            {{ $t('move') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 刪除資料夾確認對話框 -->
    <v-dialog v-model="showDeleteConfirmDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('confirmDeleteItem') }}</v-card-title>
        <v-card-text>
          <div v-if="folderToDelete" class="mt-2 text-subtitle-1">
            <v-icon class="mr-2">mdi-folder</v-icon>
            <span>{{ folderToDelete.name }}</span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteConfirmDialog = false">{{ $t('cancel') || 'Cancel' }}</v-btn>
          <v-btn color="error" @click="confirmDeleteFolder">{{ $t('delete') || 'Delete' }}</v-btn>
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
            <v-list-item-title>{{ $t('copy') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="deleteItem">
            <template #prepend>
              <v-icon>mdi-delete</v-icon>
            </template>
            <v-list-item-title>{{ $t('delete') }}</v-list-item-title>
          </v-list-item>
        </template>

        <!-- 自訂項目（經文/資料夾）：顯示複製、移動、刪除 -->
        <template v-else>
          <v-list-item @click="copyItem">
            <template #prepend>
              <v-icon>mdi-content-copy</v-icon>
            </template>
            <v-list-item-title>{{ $t('copy') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="showMoveItemDialog">
            <template #prepend>
              <v-icon>mdi-folder-move</v-icon>
            </template>
            <v-list-item-title>{{ $t('move') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="deleteItem">
            <template #prepend>
              <v-icon>mdi-delete</v-icon>
            </template>
            <v-list-item-title>{{ $t('delete') }}</v-list-item-title>
          </v-list-item>
        </template>
      </template>

      <!-- 當沒有選中項目但有複製內容時，在 custom 頁面顯示：貼上 -->
      <template v-else-if="copiedItem && multiFunctionTab === 'custom'">
        <v-list-item @click="pasteItemHandler">
          <template #prepend>
            <v-icon>mdi-content-paste</v-icon>
          </template>
          <v-list-item-title>{{ $t('paste') }}</v-list-item-title>
        </v-list-item>
      </template>

      <!-- 當沒有選中項目且沒有複製內容時，在 custom 頁面顯示：新資料夾 -->
      <template v-else-if="multiFunctionTab === 'custom'">
        <v-list-item @click="createNewFolder">
          <template #prepend>
            <v-icon>mdi-folder-plus</v-icon>
          </template>
          <v-list-item-title>{{ $t('newFolder') }}</v-list-item-title>
        </v-list-item>
      </template>
    </ContextMenu>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { VerseItem, Folder } from '@/types/common'
import { useSentry } from '@/composables/useSentry'
import { useBibleStore } from '@/stores/bible'
import ContextMenu from '@/components/ContextMenu.vue'
import { APP_CONFIG } from '@/config/app'

const { t: $t } = useI18n()

// Sentry
const { reportError } = useSentry()

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
const { removeHistoryItem, clearHistory, folderStore } = bibleStore

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
} = folderStore

// 狀態
const multiFunctionTab = ref('history')
const showFolderDialog = ref(false)
const folderName = ref('')

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
  showFolderDialog.value = true
  closeItemContextMenu()
}

const confirmCreateFolder = () => {
  if (folderName.value.trim()) {
    // Call store action - direct mutation
    addFolderToCurrent(folderName.value)
    showFolderDialog.value = false
    folderName.value = ''
  }
}

// Navigation functions (now use store actions)
const handleNavigateToFolder = (folderId: string) => {
  navigateToFolder(folderId)
}

const handleEnterFolder = (folderId: string) => {
  enterFolder(folderId)

  // Clear text selection to prevent folder name highlighting
  if (window.getSelection) {
    window.getSelection()?.removeAllRanges()
  }
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

const handleDragStart = (
  event: DragEvent,
  type: 'verse' | 'folder',
  item: VerseItem | Folder<VerseItem>,
) => {
  if (event.dataTransfer) {
    // 設置拖移數據
    event.dataTransfer.setData('application/json', JSON.stringify({ type, item }))
    event.dataTransfer.effectAllowed = 'move'

    // 創建自定義拖移圖像
    const dragImage = createDragImage(type, item)
    if (dragImage) {
      document.body.appendChild(dragImage)
      event.dataTransfer.setDragImage(dragImage, 10, 10)

      // 延遲移除拖移圖像
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage)
        }
      }, 0)
    }
  }
}

// 創建拖移時的視覺效果
const createDragImage = (
  type: 'verse' | 'folder',
  item: VerseItem | Folder<VerseItem>,
): HTMLElement | null => {
  const dragImage = document.createElement('div')
  dragImage.style.position = 'absolute'
  dragImage.style.top = '-1000px'
  dragImage.style.left = '-1000px'
  dragImage.style.pointerEvents = 'none'
  dragImage.style.zIndex = '9999'
  dragImage.style.backgroundColor = 'rgba(var(--v-theme-surface), 0.9)'
  dragImage.style.borderRadius = '4px'
  dragImage.style.padding = '8px 12px'
  dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
  dragImage.style.fontSize = '14px'
  dragImage.style.fontWeight = '500'

  if (type === 'verse') {
    const verse = item as VerseItem
    dragImage.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background-color: rgb(var(--v-theme-primary)); color: white; padding: 2px 6px; border-radius: 12px; font-size: 12px; font-weight: 500;">
          ${verse.bookAbbreviation}${verse.chapter}:${verse.verse}
        </span>
      </div>
    `
  } else {
    const folder = item as Folder<VerseItem>
    dragImage.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="mdi mdi-folder" style="color: rgb(var(--v-theme-primary)); font-size: 16px;"></i>
        <span>${folder.name}</span>
      </div>
    `
  }

  return dragImage
}

// 拖移目標處理
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  // 找到最近的 verse-item 容器
  const container = (event.target as HTMLElement).closest('.verse-item')
  if (container) {
    container.classList.add('drag-over')
  }
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // 找到最近的 verse-item 容器
  const container = (event.target as HTMLElement).closest('.verse-item')
  if (container) {
    // 檢查是否真的離開了整個容器區域
    const rect = container.getBoundingClientRect()
    const x = event.clientX
    const y = event.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      container.classList.remove('drag-over')
    }
  }
}

const handleDrop = (event: DragEvent, targetFolder: Folder<VerseItem>) => {
  event.preventDefault()

  // 移除拖移高亮效果
  const container = (event.target as HTMLElement).closest('.verse-item')
  if (container) {
    container.classList.remove('drag-over')
  }

  try {
    const data = JSON.parse(event.dataTransfer!.getData('application/json'))
    const { type, item } = data

    if (type === 'verse') {
      moveVerseToFolder(item as VerseItem, targetFolder)
    } else if (type === 'folder') {
      moveFolderToFolder(item as Folder<VerseItem>, targetFolder)
    }
  } catch (error) {
    reportError(error, {
      operation: 'drag-handling',
      component: 'MultiFunctionControl',
    })
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
  if (copiedItem.value) {
    const targetFolderId =
      currentFolder.value.id === APP_CONFIG.FOLDER.ROOT_ID
        ? APP_CONFIG.FOLDER.ROOT_ID
        : currentFolder.value.id

    if (copiedItem.value.type === 'verse') {
      // Paste verse
      pasteItem(copiedItem.value.item as VerseItem, targetFolderId, 'verse')
    } else if (copiedItem.value.type === 'folder') {
      // Paste folder
      pasteItem(copiedItem.value.item as Folder<VerseItem>, targetFolderId, 'folder')
    } else if (copiedItem.value.type === 'history') {
      // Paste history item as verse
      pasteItem(copiedItem.value.item as VerseItem, targetFolderId, 'verse')
    }
  }
  closeItemContextMenu()
}

const showMoveItemDialog = () => {
  if (selectedItem.value) {
    if (selectedItem.value.type === 'verse') {
      // 使用現有的移動功能
      showMoveDialog(selectedItem.value.item as VerseItem)
    } else if (selectedItem.value.type === 'folder') {
      // 資料夾移動功能
      showMoveFolderDialog(selectedItem.value.item as Folder<VerseItem>)
    } else if (selectedItem.value.type === 'history') {
      // 歷史項目不能移動，這個函數不應該被調用
      console.warn('History items cannot be moved')
    }
    closeItemContextMenu()
  }
}

const deleteItem = () => {
  if (selectedItem.value) {
    if (selectedItem.value.type === 'verse') {
      const verse = selectedItem.value.item as VerseItem
      removeFromCurrentFolder(verse.id)
    } else if (selectedItem.value.type === 'folder') {
      const folder = selectedItem.value.item as Folder<VerseItem>
      showDeleteFolderDialog(folder.id)
    } else if (selectedItem.value.type === 'history') {
      // 刪除歷史項目
      const historyItem = selectedItem.value.item as VerseItem
      bibleStore.removeHistoryItem(historyItem.id)
    }
  }
  closeItemContextMenu()
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

/* .move-folder-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 4px;
}

.move-folder-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
} */

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
