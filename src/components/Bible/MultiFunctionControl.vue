<template>
  <v-card :style="{ height: props.containerHeight ? `${props.containerHeight}px` : '100%' }">
    <v-card-title class="d-flex align-center justify-space-between pa-1">
      <div class="d-flex align-center">
        <v-btn-toggle v-model="multiFunctionTab" mandatory>
          <v-btn value="history" size="small" :title="$t('history')">
            <v-icon>mdi-history</v-icon>
          </v-btn>
          <v-btn value="custom" size="small" :title="$t('custom')">
            <v-icon>mdi-folder</v-icon>
          </v-btn>
        </v-btn-toggle>
        <!-- 資料夾路徑導航 -->
        <div v-if="multiFunctionTab === 'custom'" class="folder-breadcrumb ml-3">
          <v-btn
            size="small"
            class="pa-0"
            variant="text"
            :disabled="!currentFolder"
            @click="navigateToRoot"
          >
            <v-icon>mdi-home</v-icon>
            {{ $t('homepage') }}
          </v-btn>
          <v-icon v-if="currentFolderPath.length > 0" size="small">mdi-chevron-right</v-icon>
          <span v-for="(folderId, index) in currentFolderPath" :key="folderId">
            <v-btn
              size="small"
              class="pa-0"
              variant="text"
              :disabled="index === currentFolderPath.length - 1"
              @click="navigateToFolder(folderId)"
            >
              {{ getFolderById(folderId)?.name }}
            </v-btn>
            <v-icon v-if="index < currentFolderPath.length - 1" size="small"
              >mdi-chevron-right</v-icon
            >
          </span>
        </div>
      </div>
      <v-btn
        v-if="multiFunctionTab === 'custom'"
        variant="text"
        icon
        @click="createNewFolder"
        :disabled="isMaxDepthReached"
        :title="$t('new') + $t('folder')"
      >
        <v-icon>mdi-folder-plus</v-icon>
      </v-btn>
    </v-card-title>

    <v-divider />

    <v-card-text
      class="pa-0"
      :style="{
        height: props.containerHeight ? `${props.containerHeight - 60}px` : 'calc(100% - 60px)',
        overflowY: 'auto',
      }"
      @contextmenu="handleCardTextRightClick"
    >
      <!-- History Page -->
      <div v-if="multiFunctionTab === 'history'" class="history-content">
        <div v-if="historyVerses.length === 0" class="text-center pa-4 text-grey">
          {{ $t('bible.noHistory') }}
        </div>
        <div v-else class="history-list">
          <div
            v-for="(item, index) in historyVerses"
            :key="index"
            class="verse-item pa-3 d-flex align-center justify-space-between"
            @click="loadHistoryVerse(item)"
            @contextmenu="handleRightClick($event, 'history', item)"
          >
            <div>
              <div class="text-subtitle-1 font-weight-medium d-flex">
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
              @click.stop="removeHistoryItem(index)"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Custom Page -->
      <div v-else class="custom-content">
        <div class="custom-list pa-3">
          <div
            v-if="getCurrentFolders().length === 0 && getCurrentVerses().length === 0"
            class="text-center pa-4 text-grey"
          >
            {{ $t('noCustomItems') }}
          </div>
          <div v-else>
            <!-- 資料夾列表 -->
            <div v-for="folder in getCurrentFolders()" :key="folder.id" class="mb-2">
              <div
                class="verse-item pa-2 d-flex align-center justify-space-between"
                @dblclick="enterFolder(folder.id)"
                @contextmenu="handleRightClick($event, 'folder', folder)"
              >
                <div class="d-flex align-center">
                  <v-icon class="mr-2">mdi-folder</v-icon>
                  <span>{{ folder.name }}</span>
                </div>
                <v-btn
                  class="verse-btn"
                  icon
                  size="small"
                  variant="text"
                  @click.stop="deleteFolder(folder.id)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
            </div>

            <!-- 經文列表 -->
            <div
              v-for="item in getCurrentVerses()"
              :key="item.id"
              class="verse-item pa-2 mb-1 d-flex align-center justify-space-between"
              draggable="true"
              @dragstart="handleDragStart($event, item)"
              @click="loadCustomVerse(item)"
              @contextmenu="handleRightClick($event, 'verse', item)"
            >
              <div>
                <div class="text-subtitle-1 font-weight-medium d-flex">
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
        <v-card-title>{{ $t('new') + $t('folder') }}</v-card-title>
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
        <v-card-title class="d-flex align-center justify-space-between">
          <span>{{ $t('moveTo') }}</span>
          <!-- 麵包屑導航 -->
          <div class="folder-breadcrumb">
            <v-btn
              size="small"
              class="pa-0"
              variant="text"
              :disabled="moveBreadcrumb.length === 0 && !selectedMoveFolder"
              @click="navigateMoveToRoot"
            >
              <v-icon>mdi-home</v-icon>
              {{ $t('homepage') }}
            </v-btn>
            <v-icon v-if="moveBreadcrumb.length > 0 || selectedMoveFolder" size="small"
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
                {{ getFolderById(folderId)?.name }}
              </v-btn>
              <v-icon v-if="index < moveBreadcrumb.length - 1" size="small"
                >mdi-chevron-right</v-icon
              >
            </span>
          </div>
        </v-card-title>

        <v-card-text>
          <!-- 移動目標列表 -->
          <div class="move-folder-list">
            <div v-if="getMoveTargets().length === 0" class="text-center pa-4 text-grey">
              {{ $t('bible.noFolder') }}
            </div>
            <div v-else>
              <div
                v-for="target in getMoveTargets()"
                :key="target.id"
                class="move-folder-item pa-3 mb-2 d-flex align-center justify-space-between"
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
          <v-btn color="primary" @click="confirmMoveVerse" :disabled="!canMoveToHomepage">
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
    <v-menu v-model="showContextMenu" location="bottom start" :close-on-content-click="false">
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="{
            position: 'fixed',
            left: contextMenuX + 'px',
            top: contextMenuY + 'px',
            width: '1px',
            height: '1px',
            pointerEvents: 'none',
            zIndex: 9999,
          }"
        />
      </template>
      <v-list density="compact">
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
            <v-list-item @click="moveItem">
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
          <v-list-item @click="pasteItem">
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
            <v-list-item-title>{{ $t('new') + $t('folder') }}</v-list-item-title>
          </v-list-item>
        </template>
      </v-list>
    </v-menu>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import type { Verse } from '@/types/verse'

const { t: $t } = useI18n()

// 自訂資料夾介面
interface CustomFolder {
  id: string
  name: string
  expanded: boolean
  items: Verse[]
  folders: CustomFolder[]
  parentId?: string
}

// Props
interface Props {
  historyVerses: Verse[]
  customFolders: CustomFolder[]
  currentFolderPath: string[]
  currentFolder: CustomFolder | null
  containerHeight?: number
}

// Emits
interface Emits {
  (e: 'update:historyVerses', value: Verse[]): void
  (e: 'update:customFolders', value: CustomFolder[]): void
  (e: 'update:currentFolderPath', value: string[]): void
  (e: 'update:currentFolder', value: CustomFolder | null): void
  (e: 'load-history-verse', item: Verse): void
  (e: 'load-custom-verse', item: Verse): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 狀態
const multiFunctionTab = ref('history')
const showFolderDialog = ref(false)
const folderName = ref('')

// 監聽頁面切換，切換到 custom 時重置到 homepage
watch(multiFunctionTab, (newTab) => {
  if (newTab === 'custom') {
    navigateToRoot()
  }
})

// 右鍵選單相關
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const selectedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: Verse | CustomFolder
} | null>(null)

// 複製/貼上相關
const copiedItem = ref<{
  type: 'verse' | 'folder' | 'history'
  item: Verse | CustomFolder
} | null>(null)

// 移動經文相關狀態
const showMoveVerseDialog = ref(false)
const moveBreadcrumb = ref<string[]>([])
const selectedMoveFolder = ref<CustomFolder | null>(null)
const verseToMove = ref<Verse | null>(null)
const isHomepageSelected = ref(false)

// 刪除確認對話框狀態
const showDeleteConfirmDialog = ref(false)
const folderToDelete = ref<CustomFolder | null>(null)

// 歷史記錄相關函數
const removeHistoryItem = (index: number) => {
  const newHistory = [...props.historyVerses]
  newHistory.splice(index, 1)
  emit('update:historyVerses', newHistory)
}

const loadHistoryVerse = (item: Verse) => {
  emit('load-history-verse', item)
}

// 自訂資料夾相關函數
const createNewFolder = () => {
  folderName.value = ''
  showFolderDialog.value = true
  closeContextMenu()
}

const confirmCreateFolder = () => {
  if (folderName.value.trim()) {
    const newFolder: CustomFolder = {
      id: uuidv4(),
      name: folderName.value.trim(),
      expanded: false,
      items: [],
      folders: [],
      parentId: props.currentFolder?.id,
    }

    const newFolders = [...props.customFolders]

    if (props.currentFolder) {
      updateFolderInTree(newFolders, props.currentFolder.id, (folder) => {
        folder.folders.push(newFolder)
      })
    } else {
      newFolders.push(newFolder)
    }

    emit('update:customFolders', newFolders)
    showFolderDialog.value = false
    folderName.value = ''
  }
}

// 導航相關函數
const navigateToRoot = () => {
  emit('update:currentFolderPath', [])
  emit('update:currentFolder', null)
}

const navigateToFolder = (folderId: string) => {
  const folder = getFolderById(folderId)
  if (folder) {
    const index = props.currentFolderPath.indexOf(folderId)
    const newPath =
      index !== -1 ? props.currentFolderPath.slice(0, index + 1) : props.currentFolderPath
    emit('update:currentFolderPath', newPath)
    emit('update:currentFolder', folder)
  }
}

const enterFolder = (folderId: string) => {
  const folder = getFolderById(folderId)
  if (folder) {
    const newPath = [...props.currentFolderPath, folderId]
    emit('update:currentFolderPath', newPath)
    emit('update:currentFolder', folder)

    // 清除文字選擇，防止資料夾名稱被反白
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges()
    }
  }
}

const getFolderById = (folderId: string): CustomFolder | null => {
  for (const folder of props.customFolders) {
    if (folder.id === folderId) return folder
    const found = findFolderInTree(folder, folderId)
    if (found) return found
  }
  return null
}

const findFolderInTree = (folder: CustomFolder, folderId: string): CustomFolder | null => {
  for (const subFolder of folder.folders) {
    if (subFolder.id === folderId) return subFolder
    const found = findFolderInTree(subFolder, folderId)
    if (found) return found
  }
  return null
}

const getCurrentFolders = (): CustomFolder[] => {
  if (props.currentFolder) {
    // 如果在資料夾中，返回該資料夾的子資料夾
    return props.currentFolder.folders
  } else {
    // 如果在 Homepage，返回所有資料夾（除了 Homepage 資料夾本身）
    return props.customFolders.filter((folder) => folder.id !== 'homepage')
  }
}

const getCurrentVerses = (): Verse[] => {
  if (props.currentFolder) {
    // 如果在資料夾中，返回該資料夾的經文
    return props.currentFolder.items
  } else {
    // 如果在 Homepage，返回 Homepage 資料夾的經文
    const homepageFolder = props.customFolders.find((folder) => folder.id === 'homepage')
    return homepageFolder ? homepageFolder.items : []
  }
}

const deleteFolder = (folderId: string) => {
  const folder = getFolderById(folderId)
  if (folder) {
    folderToDelete.value = folder
    showDeleteConfirmDialog.value = true
  }
}

const confirmDeleteFolder = () => {
  if (folderToDelete.value) {
    const newFolders = [...props.customFolders]
    deleteFolderRecursive(newFolders, folderToDelete.value.id)
    emit('update:customFolders', newFolders)
    showDeleteConfirmDialog.value = false
    folderToDelete.value = null
  }
}

const deleteFolderRecursive = (folders: CustomFolder[], id: string): boolean => {
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i]
    if (folder && folder.id === id) {
      folders.splice(i, 1)
      return true
    }
    if (folder && folder.folders && deleteFolderRecursive(folder.folders, id)) {
      return true
    }
  }
  return false
}

const removeFromCurrentFolder = (itemId: string) => {
  const newFolders = [...props.customFolders]

  if (props.currentFolder) {
    // 從當前資料夾中移除
    updateFolderInTree(newFolders, props.currentFolder.id, (folder) => {
      folder.items = folder.items.filter((item) => item.id !== itemId)
    })
  } else {
    // 從 Homepage 資料夾中移除
    const homepageFolder = newFolders.find((folder) => folder.id === 'homepage')
    if (homepageFolder) {
      homepageFolder.items = homepageFolder.items.filter((item) => item.id !== itemId)
    }
  }

  emit('update:customFolders', newFolders)
}

const loadCustomVerse = (item: Verse) => {
  emit('load-custom-verse', item)
}

const handleDragStart = (event: DragEvent, item: Verse) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', JSON.stringify(item))
  }
}

const updateFolderInTree = (
  folders: CustomFolder[],
  folderId: string,
  updater: (folder: CustomFolder) => void,
): boolean => {
  for (const folder of folders) {
    if (folder.id === folderId) {
      updater(folder)
      return true
    }
    if (updateFolderInTree(folder.folders, folderId, updater)) {
      return true
    }
  }
  return false
}

// 移動經文相關函數
const showMoveDialog = (item: Verse) => {
  verseToMove.value = item
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
  isHomepageSelected.value = false
  showMoveVerseDialog.value = true
}

const navigateMoveToRoot = () => {
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
  isHomepageSelected.value = false
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

const selectMoveTarget = (target: CustomFolder) => {
  // 選擇資料夾
  isHomepageSelected.value = false
  const folder = getFolderById(target.id)
  if (folder && folder.folders.length > 0) {
    // 如果有子資料夾，進入該資料夾
    moveBreadcrumb.value = [...moveBreadcrumb.value, target.id]
    selectedMoveFolder.value = folder
  } else {
    // 如果沒有子資料夾，也要將資料夾添加到麵包屑中
    moveBreadcrumb.value = [...moveBreadcrumb.value, target.id]
    selectedMoveFolder.value = folder
  }
}

const getMoveFolders = (): CustomFolder[] => {
  if (selectedMoveFolder.value) {
    // 如果在某個資料夾中，返回該資料夾的子資料夾
    return selectedMoveFolder.value.folders
  } else {
    // 如果在根目錄（首頁），返回所有資料夾（除了 Homepage）
    return props.customFolders.filter((folder) => folder.id !== 'homepage')
  }
}

const getMoveTargets = (): CustomFolder[] => {
  return getMoveFolders()
}

// 計算是否可以移動
const canMoveToHomepage = computed(() => {
  if (!verseToMove.value) return false

  // 情況1：經文在首頁，想移動到資料夾 - 需要選擇資料夾
  if (!props.currentFolder) {
    return selectedMoveFolder.value !== null
  }

  // 情況2：經文在資料夾，想移動到其他位置 - 總是允許移動
  return true
})

// 計算當前資料夾深度
const currentFolderDepth = computed(() => {
  return props.currentFolderPath.length
})

// 判斷是否達到最大深度（3層）
const isMaxDepthReached = computed(() => {
  return currentFolderDepth.value >= 2 // 因為是從0開始計算，所以2就是第三層
})

const confirmMoveVerse = () => {
  if (!verseToMove.value || !canMoveToHomepage.value) return

  const newFolders = [...props.customFolders]

  // 從原位置移除經文
  if (props.currentFolder) {
    // 從當前資料夾中移除
    updateFolderInTree(newFolders, props.currentFolder.id, (folder) => {
      folder.items = folder.items.filter((item) => item.id !== verseToMove.value!.id)
    })
  } else {
    // 從 Homepage 資料夾中移除
    const homepageFolder = newFolders.find((folder) => folder.id === 'homepage')
    if (homepageFolder) {
      homepageFolder.items = homepageFolder.items.filter(
        (item) => item.id !== verseToMove.value!.id,
      )
    }
  }

  // 添加到目標位置
  if (selectedMoveFolder.value) {
    // 移動到資料夾
    updateFolderInTree(newFolders, selectedMoveFolder.value.id, (folder) => {
      folder.items.push(verseToMove.value!)
    })
  } else {
    // 移動到首頁
    let homepageFolder = newFolders.find((folder) => folder.id === 'homepage')
    if (!homepageFolder) {
      // 創建 Homepage 資料夾
      homepageFolder = {
        id: 'homepage',
        name: $t('homepage') || 'Homepage',
        expanded: false,
        items: [],
        folders: [],
      }
      newFolders.push(homepageFolder)
    }
    homepageFolder.items.push(verseToMove.value!)
  }

  emit('update:customFolders', newFolders)
  showMoveVerseDialog.value = false
  verseToMove.value = null
  selectedMoveFolder.value = null
  isHomepageSelected.value = false
  moveBreadcrumb.value = []
}

// 右鍵選單處理函數
const handleRightClick = (
  event: MouseEvent,
  type: 'verse' | 'folder' | 'history',
  item: Verse | CustomFolder,
) => {
  event.preventDefault()
  event.stopPropagation()

  selectedItem.value = { type, item }
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

// 處理 v-card-text 的右鍵點擊
const handleCardTextRightClick = (event: MouseEvent) => {
  // 如果右鍵點擊的是經文或資料夾，不處理
  if ((event.target as HTMLElement).closest('.verse-item')) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  selectedItem.value = null // 清空選中的項目
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

const closeContextMenu = () => {
  showContextMenu.value = false
  selectedItem.value = null
}

const copyItem = () => {
  if (selectedItem.value) {
    copiedItem.value = selectedItem.value
  }
  closeContextMenu()
}

const pasteItem = () => {
  if (copiedItem.value) {
    const newFolders = [...props.customFolders]

    if (copiedItem.value.type === 'verse') {
      // 複製經文
      const verse = copiedItem.value.item as Verse
      const newVerse = { ...verse, id: uuidv4() }

      if (props.currentFolder) {
        // 貼到當前資料夾
        updateFolderInTree(newFolders, props.currentFolder.id, (folder) => {
          folder.items.push(newVerse)
        })
      } else {
        // 貼到首頁
        let homepageFolder = newFolders.find((folder) => folder.id === 'homepage')
        if (!homepageFolder) {
          homepageFolder = {
            id: 'homepage',
            name: 'Homepage',
            expanded: false,
            items: [],
            folders: [],
          }
          newFolders.push(homepageFolder)
        }
        homepageFolder.items.push(newVerse)
      }
    } else if (copiedItem.value.type === 'folder') {
      // 複製資料夾
      const folder = copiedItem.value.item as CustomFolder
      const newFolder = {
        ...folder,
        id: uuidv4(),
        items: [...folder.items],
        folders: [...folder.folders],
      }

      if (props.currentFolder) {
        // 貼到當前資料夾
        updateFolderInTree(newFolders, props.currentFolder.id, (targetFolder) => {
          targetFolder.folders.push(newFolder)
        })
      } else {
        // 貼到首頁（根目錄）
        newFolders.push(newFolder)
      }
    } else if (copiedItem.value.type === 'history') {
      // 複製歷史項目到自訂
      const historyItem = copiedItem.value.item as Verse
      const newVerse: Verse = {
        ...historyItem,
        id: uuidv4(),
        timestamp: Date.now(),
      }

      if (props.currentFolder) {
        // 貼到當前資料夾
        updateFolderInTree(newFolders, props.currentFolder.id, (folder) => {
          folder.items.push(newVerse)
        })
      } else {
        // 貼到首頁
        let homepageFolder = newFolders.find((folder) => folder.id === 'homepage')
        if (!homepageFolder) {
          homepageFolder = {
            id: 'homepage',
            name: 'Homepage',
            expanded: false,
            items: [],
            folders: [],
          }
          newFolders.push(homepageFolder)
        }
        homepageFolder.items.push(newVerse)
      }
    }

    emit('update:customFolders', newFolders)
  }
  closeContextMenu()
}

const moveItem = () => {
  if (selectedItem.value) {
    if (selectedItem.value.type === 'verse') {
      // 使用現有的移動功能
      showMoveDialog(selectedItem.value.item as Verse)
    } else if (selectedItem.value.type === 'folder') {
      // 資料夾移動功能（暫時使用刪除確認對話框）
      showDeleteConfirmDialog.value = true
      folderToDelete.value = selectedItem.value.item as CustomFolder
    } else if (selectedItem.value.type === 'history') {
      // 歷史項目不能移動，這個函數不應該被調用
      console.warn('History items cannot be moved')
    }
    // 移動 closeContextMenu 到這裡
    closeContextMenu()
  }
}

const deleteItem = () => {
  if (selectedItem.value) {
    if (selectedItem.value.type === 'verse') {
      const verse = selectedItem.value.item as Verse
      removeFromCurrentFolder(verse.id)
    } else if (selectedItem.value.type === 'folder') {
      const folder = selectedItem.value.item as CustomFolder
      deleteFolder(folder.id)
    } else if (selectedItem.value.type === 'history') {
      // 刪除歷史項目
      const historyItem = selectedItem.value.item as Verse
      const index = props.historyVerses.findIndex((item) => item.id === historyItem.id)
      if (index !== -1) {
        const newHistoryVerses = [...props.historyVerses]
        newHistoryVerses.splice(index, 1)
        emit('update:historyVerses', newHistoryVerses)
      }
    }
  }
  closeContextMenu()
}

// 處理點擊事件，在有選單顯示時阻止事件傳播
const handleDocumentClick = (event: Event) => {
  if (showContextMenu.value) {
    const target = event.target as Element

    // 檢查點擊的目標是否在右鍵選單內
    const isClickOnMenu =
      target.closest('.v-menu') || target.closest('.v-list') || target.closest('.v-list-item')

    if (!isClickOnMenu) {
      event.stopPropagation()
      event.stopImmediatePropagation()
      event.preventDefault()
      closeContextMenu()
      return false
    }
  }
}

// 監聽點擊事件來關閉右鍵選單
onMounted(() => {
  document.addEventListener('click', handleDocumentClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick, true)
})
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

.move-folder-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 4px;
}

.move-folder-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
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
