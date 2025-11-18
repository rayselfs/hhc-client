<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Preview -->
      <v-col cols="6" class="pl-4 pt-4 pb-4 pr-2" ref="leftColumnContainer">
        <v-card class="display-flex flex-column" :style="{ height: `${leftCardHeight}px` }">
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <div>
                <span class="mr-1">{{ currentBookName || $t('preview') }}</span>
                <span v-if="isSearchMode"> ({{ $t('search') }})</span>
              </div>
              <div v-if="currentPassage">
                <span class="mr-1">{{ currentPassage.chapter }}</span>
                <span class="mr-1">:</span>
                <span>{{ currentPassage.verse }}</span>
              </div>
            </div>
            <div v-if="currentPassage" class="d-flex align-center gap-2">
              <v-btn
                size="small"
                class="mr-1"
                :disabled="currentPassage.chapter <= 1"
                @click="goToPreviousChapterPreview"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
              <v-btn
                size="small"
                :disabled="currentPassage.chapter >= maxChapters"
                @click="goToNextChapterPreview"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </div>
          </v-card-title>

          <v-divider />

          <v-card-text
            class="bible-content-wrapper pl-2 pr-2 pa-0"
            :style="{ height: `${leftCardHeight - 48}px`, position: 'relative' }"
          >
            <!-- Loading 狀態 -->
            <div
              class="align-center justify-center"
              :class="{ 'd-none': !isLoadingVerses, 'd-flex': isLoadingVerses }"
              :style="{ height: `${leftCardHeight - 48}px` }"
            >
              <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            </div>

            <!-- 搜索結果 -->
            <div class="bible-content" v-show="!isLoadingVerses && isSearchMode">
              <!-- 沒有搜索結果 -->
              <div
                v-if="searchResultsDisplay.length === 0 && !isLoadingVerses"
                class="d-flex align-center justify-center"
                :style="{ height: `${leftCardHeight - 48}px` }"
              >
                <div class="text-center">
                  <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-magnify</v-icon>
                  <div class="text-h6 text-grey">
                    {{ $t('bible.search.noResults') || '沒有找到相關經文' }}
                  </div>
                </div>
              </div>

              <!-- 搜索結果列表 -->
              <template v-else>
                <div
                  v-for="result in searchResultsDisplay"
                  :key="result.verse_id"
                  class="verse-item mb-2 d-flex align-center"
                  @click="handleSearchResultClick(result)"
                >
                  <div class="verse-content d-flex align-start flex-1 text-h6">
                    <span class="mr-1 text-subtitle-1 font-weight-medium search-verse-reference">
                      {{ result.book_abbreviation }}{{ result.chapter_number }}:{{
                        result.verse_number
                      }}
                    </span>
                    <span class="mr-1 text-subtitle-1">-</span>
                    <p
                      class="text-justify"
                      v-html="highlightSearchText(result.text, searchText)"
                    ></p>
                  </div>
                </div>
              </template>
            </div>

            <!-- 經文內容 -->
            <div class="bible-content" v-show="!isLoadingVerses && !isSearchMode">
              <div
                v-for="verse in chapterVerses"
                :key="verse.number"
                :data-verse="verse.number"
                class="verse-item mb-2 d-flex align-center"
                :class="{
                  'verse-highlighted': currentPassage && verse.number === currentPassage.verse,
                }"
                @click="selectVerse(verse.number)"
                @contextmenu="handleVerseRightClick($event, verse)"
              >
                <div class="verse-content d-flex align-start flex-1 text-h6">
                  <span class="verse-number mr-1 text-subtitle-1">{{ verse.number }}</span>
                  <span class="text-justify">{{ verse.text }}</span>
                </div>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  class="verse-btn"
                  @click.stop="addVerseToCustom(verse.number)"
                >
                  <v-icon size="small">mdi-plus</v-icon>
                </v-btn>
              </div>
              <BottomSpacer />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6" class="pl-2 pt-4 pb-4 pr-4" ref="rightColumnContainer">
        <v-row no-gutters class="fill-height">
          <!-- Multi Function Control -->
          <v-col cols="12" class="mb-4" :style="{ height: `${rightTopCardHeight}px` }">
            <MultiFunctionControl :container-height="rightTopCardHeight" @load-verse="loadVerse" />
          </v-col>

          <!-- Projection Control -->
          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <v-card :style="{ height: `${rightBottomCardHeight}px` }">
              <v-card-text>
                <!-- Chapter/Verse Navigation -->
                <v-row class="mb-3">
                  <v-col cols="6">
                    <v-label class="text-subtitle-1">{{ $t('bible.controlChapter') }}</v-label>
                  </v-col>
                  <v-col cols="6">
                    <v-label class="text-subtitle-1">{{ $t('bible.controlVerse') }}</v-label>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-end pa-0 pr-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.chapter <= 1"
                      @click="goToPreviousChapterProjection"
                    >
                      <v-icon>mdi-chevron-left</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-start pa-0 pl-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.chapter >= maxChapters"
                      @click="goToNextChapterProjection"
                    >
                      <v-icon>mdi-chevron-right</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-end pa-0 pr-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.verse <= 1"
                      @click="goToPreviousVerseProjection"
                    >
                      <v-icon>mdi-chevron-up</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-start pa-0 pl-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!hasCurrentPassage || (currentPassage?.verse ?? 0) >= maxVerse"
                      @click="goToNextVerseProjection"
                    >
                      <v-icon>mdi-chevron-down</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>
                <!-- Font Size Slider -->
                <v-row>
                  <v-col cols="12">
                    <v-label class="text-subtitle-1 mb-2">{{
                      $t('bible.controlFontSize')
                    }}</v-label>
                    <v-slider
                      v-model="fontSize"
                      :min="BIBLE_CONFIG.FONT.MIN_SIZE"
                      :max="BIBLE_CONFIG.FONT.MAX_SIZE"
                      :step="BIBLE_CONFIG.FONT.SIZE_STEP"
                      thumb-label
                      @update:model-value="handleFontSizeUpdate"
                    >
                      <template #thumb-label="{ modelValue }"> {{ modelValue }}px </template>
                    </v-slider>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- 右鍵選單 -->
    <ContextMenu ref="contextMenuRef" :close-on-content-click="false">
      <v-list-item @click="copyVerseText">
        <template #prepend>
          <v-icon>mdi-content-copy</v-icon>
        </template>
        <v-list-item-title>{{ $t('bible.copyVerseContent') }}</v-list-item-title>
      </v-list-item>
    </ContextMenu>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'
import { APP_CONFIG, BIBLE_CONFIG } from '@/config/app'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import type { VerseItem } from '@/types/common'
import type { BiblePassage, PreviewVerse, SearchResult, SearchResultDisplay } from '@/types/bible'
import { useSentry } from '@/composables/useSentry'
import { useCardLayout } from '@/composables/useLayout'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useBible } from '@/composables/useBible'
import { useAPI } from '@/composables/useAPI'
import ContextMenu from '@/components/ContextMenu.vue'
import MultiFunctionControl from '@/components/Bible/MultiFunction/Control.vue'
import BottomSpacer from '@/components/Main/BottomSpacer.vue'

const { t: $t } = useI18n()
const { reportError } = useSentry()
const { getLocalItem, setLocalItem } = useLocalStorage()
const bibleStore = useBibleStore()
const {
  currentVersion,
  selectedVerse: storeSelectedVerse,
  currentBibleContent,
} = storeToRefs(bibleStore)
const { getBibleContent, addToHistory } = bibleStore
const { searchBibleVerses } = useAPI()

const { leftCardHeight, rightTopCardHeight, rightBottomCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
  topCardRatio: 0.7,
})

// 當前選中的經文
const currentPassage = ref<BiblePassage | null>(null)
const chapterVerses = ref<PreviewVerse[]>([])
const currentBookData = ref<{
  code?: string
  number: number
  name: string
  chapters: Array<{ number: number; verses: Array<{ number: number; text: string }> }>
} | null>(null) // 存儲當前書卷的完整數據

// 字型大小控制
const getInitialFontSize = () => {
  // 從 localStorage 讀取上次設定的字型大小，如果沒有則使用預設值
  const savedFontSize = getLocalItem<number>(
    getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
  )
  return savedFontSize ? savedFontSize : BIBLE_CONFIG.FONT.DEFAULT_SIZE
}
const fontSize = ref(getInitialFontSize())

// Use Bible composable for folder management, navigation and projection
const {
  folderStore,
  addVerseToCurrent,
  scrollToVerse,
  maxChapters,
  goToPreviousChapter,
  goToNextChapter,
  goToPreviousVerse,
  goToNextVerse,
  updateProjection,
  updateProjectionFontSize: updateFontSize,
} = useBible(currentPassage, currentBookData, chapterVerses)

const { loadRootFolder } = folderStore

// 優化的計算屬性（緩存常用計算）
const maxVerse = computed(() => chapterVerses.value.length)
const hasCurrentPassage = computed(() => !!currentPassage.value)
const currentBookName = computed(() => currentPassage.value?.bookName || '')

// Loading 狀態
const isLoadingVerses = ref(false)

// 搜索結果狀態
const searchResults = ref<SearchResult[]>([])
const isSearchMode = ref(false)
const searchText = ref('')

// 搜索結果顯示（包含書卷縮寫）
const searchResultsDisplay = computed<SearchResultDisplay[]>(() => {
  if (!currentBibleContent.value || searchResults.value.length === 0) {
    return []
  }

  return searchResults.value.map((result) => {
    const book = currentBibleContent.value?.books.find((b) => b.number === result.book_number)
    return {
      ...result,
      book_abbreviation: book?.abbreviation || '',
    }
  })
})

// 高亮搜索關鍵字
const highlightSearchText = (text: string, searchTerm: string): string => {
  if (!searchTerm || !text) {
    return text
  }

  const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedSearchTerm})`, 'gi')

  const highlighted = text.replace(
    regex,
    '<span style="color: rgb(var(--v-theme-error));">$1</span>',
  )
  return highlighted
}

// 右鍵選單相關
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const selectedVerse = ref<{ number: number; text: string } | null>(null)

// set preview verse
const handleVerseSelection = async (bookNumber: number, chapter: number, verse: number) => {
  const versionId = currentVersion.value?.id
  if (!versionId) {
    reportError(new Error('No Bible version selected'), {
      operation: 'handle-verse-selection',
      component: 'BibleControl',
      extra: { bookNumber, chapter, verse },
    })
    isLoadingVerses.value = false
    return
  }

  // 從 store 中獲取聖經內容
  const content = await getBibleContent(versionId)
  if (!content) {
    reportError(new Error('Bible content not found'), {
      operation: 'handle-verse-selection',
      component: 'BibleControl',
      extra: { versionId, bookNumber, chapter, verse },
    })
    isLoadingVerses.value = false
    return
  }

  // 從內容中查找對應的書卷
  const book = content.books.find((b) => b.number === bookNumber)
  if (!book) {
    reportError(new Error('Book not found'), {
      operation: 'handle-verse-selection',
      component: 'BibleControl',
      extra: { versionId, bookNumber, chapter, verse },
    })
    isLoadingVerses.value = false
    return
  }

  // 更新當前經文信息
  currentPassage.value = {
    bookAbbreviation: book.abbreviation || '',
    bookName: book.name,
    bookNumber: book.number,
    chapter,
    verse,
  }

  // 存儲當前書卷數據
  currentBookData.value = book

  // 從選中的書卷中獲取真實的經文內容
  const selectedChapter = book.chapters.find((ch) => ch.number === chapter)
  if (selectedChapter) {
    // 清空舊的經文內容
    chapterVerses.value = []

    // 等待 DOM 更新
    await nextTick()

    // 設置新的經文內容（此時內容在背景渲染，但被 v-show 隱藏）
    chapterVerses.value = selectedChapter.verses.map((v: { number: number; text: string }) => ({
      number: v.number,
      text: v.text,
    }))

    // 等待一個 tick 讓 Vue 開始處理響應式更新
    await nextTick()

    isLoadingVerses.value = false

    // 滾動到指定節（使用 setTimeout 避免阻塞）
    setTimeout(() => {
      scrollToVerse(verse, 'instant')
    }, 0)
  }
}

/**
 * 創建 VerseItem 物件
 * @param verseNumber - 節號
 * @returns VerseItem 物件，如果 currentPassage 不存在則返回 null
 */
const createMultiFunctionVerse = (verseNumber: number): VerseItem | null => {
  if (!currentPassage.value) return null

  const verseText = chapterVerses.value.find((v) => v.number === verseNumber)?.text || ''

  return {
    id: crypto.randomUUID(),
    type: 'verse',
    bookAbbreviation: currentPassage.value.bookAbbreviation,
    bookNumber: currentPassage.value.bookNumber,
    chapter: currentPassage.value.chapter,
    verse: verseNumber,
    verseText,
    timestamp: Date.now(),
  }
}

// 添加到歷史記錄
const addToHistoryFromVerse = (verseNumber: number) => {
  if (!currentPassage.value) return

  const newHistoryItem = createMultiFunctionVerse(verseNumber)
  if (!newHistoryItem) return

  addToHistory(newHistoryItem)
}

// 點擊選擇經文
const selectVerse = (verseNumber: number) => {
  if (currentPassage.value) {
    currentPassage.value.verse = verseNumber
    addToHistoryFromVerse(verseNumber)
    updateProjection(verseNumber)
  }
}

// 上一章 (只影響預覽)
const goToPreviousChapterPreview = () => {
  goToPreviousChapter(false)
}

// 下一章 (只影響預覽)
const goToNextChapterPreview = () => {
  goToNextChapter(false)
}

// 投影控制函數
// 上一章 (影響投影)
const goToPreviousChapterProjection = () => {
  goToPreviousChapter(true, updateProjection)
}

// 下一章 (影響投影)
const goToNextChapterProjection = () => {
  goToNextChapter(true, updateProjection)
}

// 上一節 (影響投影)
const goToPreviousVerseProjection = () => {
  goToPreviousVerse(true, updateProjection)
}

// 下一節 (影響投影)
const goToNextVerseProjection = () => {
  goToNextVerse(true, updateProjection)
}

// 更新投影字型大小
const handleFontSizeUpdate = () => {
  setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE), fontSize.value)
  updateFontSize(fontSize.value)
}

// 歷史記錄相關函數
const loadVerse = async (item: VerseItem, type: 'history' | 'custom') => {
  try {
    isLoadingVerses.value = true
    await handleVerseSelection(item.bookNumber, item.chapter, item.verse)

    if (type === 'custom') {
      updateProjection(item.verse)
    }
  } catch (error) {
    reportError(error, {
      operation: 'load-verse',
      component: 'BibleControl',
      extra: { verseId: item.id },
    })
  }
}

const addVerseToCustom = (verseNumber: number) => {
  if (!currentPassage.value) return

  const newVerse = createMultiFunctionVerse(verseNumber)
  if (!newVerse) return

  // Call store action - it handles duplicate checking
  addVerseToCurrent(newVerse)
}

// 快捷鍵處理
const handleKeydown = (event: KeyboardEvent) => {
  // 避免在輸入框中觸發快捷鍵
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  // 只有在有當前經文時才響應快捷鍵
  if (!currentPassage.value) return

  switch (event.code) {
    case 'ArrowUp':
      event.preventDefault()
      goToPreviousVerseProjection()
      break
    case 'ArrowDown':
      event.preventDefault()
      goToNextVerseProjection()
      break
  }
}

// 右鍵選單處理函數
const handleVerseRightClick = (event: MouseEvent, verse: { number: number; text: string }) => {
  selectedVerse.value = verse
  contextMenuRef.value?.open(event)
}

const closeVerseContextMenu = () => {
  contextMenuRef.value?.close()
  selectedVerse.value = null
}

// useContextMenu composable 已經處理了點擊外部關閉選單的邏輯，不需要手動監聽

const copyVerseText = async () => {
  if (selectedVerse.value && currentPassage.value) {
    const verseText = `${currentPassage.value.bookName} ${currentPassage.value.chapter}:${selectedVerse.value.number} ${selectedVerse.value.text}`

    try {
      await navigator.clipboard.writeText(verseText)
      // 可以添加一個提示訊息
      closeVerseContextMenu()
    } catch (err) {
      reportError(err, {
        operation: 'copy-verse-text',
        component: 'BibleControl',
        extra: { text: verseText },
      })
      // 降級方案：使用舊的複製方法
      const textArea = document.createElement('textarea')
      textArea.value = verseText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }
  closeVerseContextMenu()
}

// 監聽 store 中的經文選擇狀態
watch(
  storeSelectedVerse,
  async (newVerse) => {
    if (newVerse) {
      isLoadingVerses.value = true
      await handleVerseSelection(newVerse.bookNumber, newVerse.chapter, newVerse.verse)
    }
  },
  { immediate: false },
)

// 處理搜索結果點擊
const handleSearchResultClick = async (result: SearchResult) => {
  isSearchMode.value = false
  isLoadingVerses.value = true
  await handleVerseSelection(result.book_number, result.chapter_number, result.verse_number)
}

// 處理搜索
const handleSearch = async (text: string) => {
  if (!text.trim()) {
    return
  }

  currentPassage.value = null
  const versionId = currentVersion.value?.id
  const versionCode = currentVersion.value?.code
  if (!versionId || !versionCode) {
    reportError(new Error('No Bible version selected'), {
      operation: 'handle-search',
      component: 'BibleControl',
      extra: { searchText: text },
    })
    return
  }

  // 設置 loading 狀態
  isLoadingVerses.value = true
  isSearchMode.value = true

  try {
    // 保存搜索文本（用於高亮顯示）
    searchText.value = text.trim()

    // 確保 bible content 已載入（用於查找書卷縮寫）
    if (!currentBibleContent.value) {
      await getBibleContent(versionId)
    }

    // 執行搜索
    const results = await searchBibleVerses(text, versionCode, 20)
    searchResults.value = results
  } catch (error) {
    reportError(error, {
      operation: 'handle-search',
      component: 'BibleControl',
      extra: { searchText: text, versionCode },
    })
    searchResults.value = []
  } finally {
    isLoadingVerses.value = false
  }
}

onMounted(() => {
  loadRootFolder()

  document.addEventListener('keydown', handleKeydown)

  // 監聽搜索事件
  const handleSearchEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ text: string }>
    handleSearch(customEvent.detail.text)
  }
  window.addEventListener('bible-search', handleSearchEvent)

  // 清理事件監聽器
  onUnmounted(() => {
    window.removeEventListener('bible-search', handleSearchEvent)
    document.removeEventListener('keydown', handleKeydown)
  })
})
</script>

<style scoped>
.bible-content-wrapper {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.bible-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

.bible-content {
  line-height: 1.8;
}

.verse-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.verse-number {
  min-width: 20px;
  text-align: right;
}

.history-verse-number {
  min-width: 80px;
}

.verse-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 8px;
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.2);
}

.verse-highlighted {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.verse-highlighted .verse-number {
  color: rgb(var(--v-theme-primary));
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}

.verse-content {
  flex: 1;
}

.search-verse-reference {
  white-space: nowrap;
  flex-shrink: 0;
}

.search-highlight {
  color: rgb(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.1);
  padding: 2px 4px;
  border-radius: 2px;
}
</style>
