<template>
  <v-app-bar dark prominent>
    <v-app-bar-nav-icon @click="emitToggleDrawer">
      <v-icon>{{ drawerCollapsed ? 'mdi-menu' : 'mdi-menu-open' }}</v-icon>
    </v-app-bar-nav-icon>
    <v-app-bar-title class="text-h5">{{ toolbarTitle }}</v-app-bar-title>
    <v-spacer />

    <!-- 聖經版本選擇器組 -->
    <div class="bible-version-selector-wrapper">
      <v-select
        v-model="selectedVersion"
        :items="bibleVersions"
        item-title="name"
        item-value="id"
        :loading="apiLoading || contentLoading"
        density="compact"
        variant="outlined"
        hide-details
        class="bible-version-selector mr-2"
        :disabled="apiLoading || contentLoading"
      >
      </v-select>

      <!-- 書卷選擇按鈕 -->
      <v-btn
        variant="outlined"
        :disabled="!selectedVersion"
        @click="showBooksDialog = true"
        :title="$t('bible.title')"
        class="books-btn"
      >
        <v-icon>mdi-book-open-page-variant</v-icon>
      </v-btn>
    </div>

    <v-spacer />

    <v-slide-x-reverse-transition>
      <v-text-field
        v-if="isSearching && showSearch"
        v-model="searchQuery"
        autofocus
        variant="solo-inverted"
        hide-details
        :placeholder="getSearchPlaceholder(props.currentView)"
        density="compact"
        class="mr-2"
        style="width: 250px"
        @keydown.esc="handleCloseSearch"
      />
    </v-slide-x-reverse-transition>

    <v-btn
      v-if="!isSearching && showSearch"
      icon
      @click="handleStartSearch"
      :title="$t('search')"
      class="mr-1"
    >
      <v-icon>mdi-magnify</v-icon>
    </v-btn>

    <v-btn v-else-if="isSearching && showSearch" icon @click="handleCloseSearch">
      <v-icon>mdi-close</v-icon>
    </v-btn>

    <v-btn
      class="mr-1"
      @click="toggleProjectionContent"
      :color="!projectionStore.isShowingDefault ? 'error' : 'default'"
      :title="
        projectionStore.isShowingDefault
          ? $t('open') + $t('projection.title')
          : $t('close') + $t('projection.title')
      "
      variant="outlined"
    >
      <v-icon v-if="projectionStore.isShowingDefault" class="mr-2">mdi-monitor</v-icon>
      <v-icon v-else class="mr-2">mdi-monitor-off</v-icon>
      {{ $t('projection.title') }}
    </v-btn>

    <v-btn
      class="mr-4"
      @click="closeProjectionWindow"
      color="error"
      :title="$t('close') + $t('projection.title') + $t('window')"
      icon
    >
      <v-icon>mdi-close</v-icon>
    </v-btn>
  </v-app-bar>

  <!-- 聖經書卷選擇 Dialog -->
  <BibleBooksDialog
    v-model="showBooksDialog"
    :version-id="selectedVersion"
    @select-book="handleSelectBook"
    @select-verse="handleSelectVerse"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useSearch } from '@/composables/useSearch'
import { useAPI } from '@/composables/useAPI'
import { useAlert } from '@/composables/useAlert'
import type { BibleVersion, BibleBook } from '@/types/bible'
import { useBibleCache } from '@/composables/useBibleCache'
import { ViewType } from '@/types/common'
import BibleBooksDialog from '@/components/Bible/BibleBooksDialog.vue'

// i18n
const { t: $t } = useI18n()

// Electron composable
const { isElectron, onProjectionOpened, onProjectionClosed, checkProjectionWindow } = useElectron()

// 投影消息管理
const { setProjectionState, syncAllStates, sendTimerUpdate } = useProjectionMessaging()

// Alert 管理
const { warning } = useAlert()

// 搜尋管理
const { searchQuery, isSearching, getSearchPlaceholder, executeSearch, startSearch, closeSearch } =
  useSearch()

// API 管理
const { loading: apiLoading, getBibleVersions, getBibleContent } = useAPI()
const {
  saveBibleContent,
  getBibleContent: getCachedContent,
  hasCachedContent,
  // deleteCachedContent,
} = useBibleCache()
const bibleVersions = ref<BibleVersion[]>([])
const selectedVersion = ref<number | null>(null)
const contentLoading = ref(false)
const showBooksDialog = ref(false)

// Props
const props = defineProps<{
  currentView: string
  drawerCollapsed: boolean
}>()

// Drawer 的事件發送
const emit = defineEmits<{
  (e: 'toggle-drawer'): void
  (e: 'search', query: string): void
}>()

// 計算標題
const toolbarTitle = computed(() => {
  switch (props.currentView) {
    case 'bible':
      return $t('bible.title')
    case 'timer':
      return $t('timer.title')
    case 'media':
      return $t('media.title')
    default:
      return 'HHC Project Client'
  }
})

// 是否顯示搜尋功能（計時器頁面時隱藏）
const showSearch = computed(() => {
  return props.currentView !== 'timer'
})

const emitToggleDrawer = () => {
  emit('toggle-drawer')
}

// 處理搜尋開始
const handleStartSearch = () => {
  startSearch()
}

// 處理搜尋關閉
const handleCloseSearch = () => {
  closeSearch()
  emit('search', '')
}

// 監聽搜尋查詢變化
watch(searchQuery, (newQuery) => {
  executeSearch(props.currentView, newQuery)
  emit('search', newQuery)
})

// 投影功能
const projectionStore = useProjectionStore()

// 切換投影內容
const toggleProjectionContent = async () => {
  // 計算新的投影狀態
  const newShowDefault = !projectionStore.isShowingDefault

  // 如果是要開啟投影，根據主視窗當前頁面設置投影內容
  if (!newShowDefault) {
    // 開啟投影：根據主視窗當前頁面切換到對應的投影頁面
    // setProjectionState 會自動檢查並創建投影窗口
    await setProjectionState(false, props.currentView as ViewType)

    // 根據不同頁面發送對應的內容更新
    if (props.currentView === 'timer') {
      sendTimerUpdate(true)
    }
    // 聖經頁面會在 ProjectionView 請求當前狀態時自動更新
  } else {
    // 關閉投影：只切換狀態，不改變視圖
    await setProjectionState(true)
  }
}

// 關閉投影窗口
const closeProjectionWindow = async () => {
  if (isElectron()) {
    try {
      // 檢查投影窗口是否存在
      const projectionExists = await checkProjectionWindow()
      if (!projectionExists) {
        console.log('Projection window does not exist, nothing to close')
        return
      }

      // 使用 useAlert 的 warning 函數顯示確認對話框
      const confirmed = await warning(
        $t('projection.confirmClose'),
        $t('close') + $t('projection.title') + $t('window'),
      )

      if (confirmed) {
        // 用戶確認後才關閉
        await window.electronAPI.closeProjectionWindow()

        // 重置投影狀態為預設
        projectionStore.setShowingDefault(true)
      }
    } catch (error) {
      console.error('Error closing projection window:', error)
    }
  }
}

// 載入聖經版本列表
const loadBibleVersions = async () => {
  try {
    const versions = await getBibleVersions()
    bibleVersions.value = versions

    // 設定預設選擇第一個版本
    if (versions.length > 0 && !selectedVersion.value && versions[0]) {
      selectedVersion.value = versions[0].id
    }
  } catch (error) {
    console.error('Error loading Bible versions:', error)
  }
}

/**
 * 載入聖經內容 (優先從快取讀取)
 * @param versionId - 版本 ID
 * @param forceRefresh - 是否強制重新 fetch
 */
const loadBibleContentForVersion = async (versionId: number, forceRefresh = false) => {
  contentLoading.value = true

  try {
    // 查找版本信息
    const version = bibleVersions.value.find((v) => v.id === versionId)
    if (!version) {
      console.error('Version not found:', versionId)
      return
    }

    // 如果不是強制刷新，先檢查快取
    if (!forceRefresh) {
      const hasCached = await hasCachedContent(versionId)
      if (hasCached) {
        const cachedContent = await getCachedContent(versionId)
        if (cachedContent) {
          return
        }
      }
    }

    // 從 API 獲取內容
    const content = await getBibleContent(versionId)

    // 儲存到快取
    await saveBibleContent(versionId, version.code, version.name, content)
  } catch (error) {
    console.error('Error loading Bible content:', error)
  } finally {
    contentLoading.value = false
  }
}

// 監聽版本變化
watch(selectedVersion, async (newVersion) => {
  if (newVersion) {
    localStorage.setItem('selected-bible-version', newVersion.toString())
    await loadBibleContentForVersion(newVersion, false)
  }
})

// // 處理重新整理按鈕
// const handleRefreshContent = async () => {
//   if (!selectedVersion.value) return

//   // 先刪除快取
//   await deleteCachedContent(selectedVersion.value)

//   // 強制重新 fetch
//   await loadBibleContentForVersion(selectedVersion.value, true)
// }

// 處理書卷選擇
const handleSelectBook = (book: BibleBook) => {
  console.log('Selected book:', book)
  // TODO: 實現書卷選擇後的邏輯
}

// 處理經文選擇
const handleSelectVerse = (book: BibleBook, chapter: number, verse: number) => {
  // 發送全局事件給BibleViewer組件
  window.dispatchEvent(
    new CustomEvent('bible-verse-selected', {
      detail: { book, chapter, verse },
    }),
  )
}

onMounted(() => {
  // 初始化時同步所有狀態到投影窗口（包含投影狀態、計時器狀態、主題等）
  syncAllStates()

  // 載入聖經版本列表
  loadBibleVersions()

  // 監聽投影窗口狀態變化
  if (isElectron()) {
    onProjectionOpened(() => {
      // 投影窗口開啟時，預設顯示預設內容（投影關閉狀態）
      projectionStore.setShowingDefault(true)
    })

    onProjectionClosed(() => {
      // 投影窗口關閉時，重置為預設內容狀態
      projectionStore.setShowingDefault(true)
    })
  }
})
</script>

<style scoped>
.bible-version-selector-wrapper {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bible-version-selector {
  width: 180px;
  min-width: 180px;
  max-width: 180px;
}

.bible-version-selector > .v-input__control > .v-field {
  height: 36px;
}

.refresh-btn,
.books-btn {
  height: 36px;
  margin-top: 0px;
}
</style>
