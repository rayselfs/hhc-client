<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Preview -->
      <v-col cols="6" class="pl-4 pt-4 pb-4 pr-2" ref="leftColumnContainer">
        <v-card class="display-flex flex-column" :style="{ height: `${leftCardHeight}px` }">
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <span class="mr-2">{{ currentPassage?.bookName || $t('preview') }}</span>
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
                :disabled="currentPassage.chapter >= getMaxChapters()"
                @click="goToNextChapterPreview"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </div>
          </v-card-title>

          <v-divider />

          <v-card-text
            class="bible-content-wrapper pl-2 pr-2 pa-0"
            :style="{ height: `${leftCardHeight - 48}px` }"
          >
            <div class="bible-content">
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
                  <span class="verse-number mr-1">{{ verse.number }}</span>
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
            </div>
            <BottomSpacer />
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
                      :disabled="!currentPassage || currentPassage.chapter >= getMaxChapters()"
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
                      :disabled="!currentPassage || currentPassage.verse >= chapterVerses.length"
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'
import { APP_CONFIG, BIBLE_CONFIG } from '@/config/app'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import type { VerseItem } from '@/types/common'
import { useSentry } from '@/composables/useSentry'
import { useCardLayout } from '@/composables/useLayout'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useBible } from '@/composables/useBible'
import ContextMenu from '@/components/ContextMenu.vue'
import MultiFunctionControl from '@/components/Bible/MultiFunction/Control.vue'
import BottomSpacer from '@/components/Main/BottomSpacer.vue'

interface BiblePassage {
  bookAbbreviation: string
  bookName: string
  bookNumber: number
  chapter: number
  verse: number
  versionId?: number
}

interface PreviewVerse {
  number: number
  text: string
}

const { t: $t } = useI18n()
const { reportError } = useSentry()
const { getLocalItem, setLocalItem } = useLocalStorage()
const bibleStore = useBibleStore()
const { currentVersion } = storeToRefs(bibleStore)
const { getBibleContent, addToHistory } = bibleStore

const { leftCardHeight, rightTopCardHeight, rightBottomCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
  topCardRatio: 0.7,
})

// 當前選中的經文
const currentPassage = ref<BiblePassage | null>(null)
const chapterVerses = ref<PreviewVerse[]>([])
const shouldScrollToVerse = ref(false)
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
  getMaxChapters,
  goToPreviousChapter,
  goToNextChapter,
  goToPreviousVerse,
  goToNextVerse,
  updateProjection,
  updateProjectionFontSize: updateFontSize,
} = useBible(currentPassage, currentBookData, chapterVerses)

const { loadRootFolder } = folderStore

// 右鍵選單相關
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const selectedVerse = ref<{ number: number; text: string } | null>(null)

// 監聽來自父組件的經文選擇事件
const handleVerseSelection = (
  book: {
    abbreviation?: string
    number: number
    name: string
    chapters: Array<{ number: number; verses: Array<{ number: number; text: string }> }>
  },
  chapter: number,
  verse: number,
) => {
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
    chapterVerses.value = selectedChapter.verses.map((v: { number: number; text: string }) => ({
      number: v.number,
      text: v.text,
    }))

    // 只有從 dialog 選擇時才滾動
    shouldScrollToVerse.value = true
    nextTick(() => {
      scrollToVerse(verse)
      shouldScrollToVerse.value = false
    })
  }
}

// 更新投影畫面（包含歷史記錄）
const updateProjectionWithHistory = async (verseNumber: number) => {
  await updateProjection(verseNumber)
  addToHistoryFromVerse(verseNumber)
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
    updateProjectionWithHistory(verseNumber)
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
  goToPreviousChapter(true, updateProjectionWithHistory)
}

// 下一章 (影響投影)
const goToNextChapterProjection = () => {
  goToNextChapter(true, updateProjectionWithHistory)
}

// 上一節 (影響投影)
const goToPreviousVerseProjection = () => {
  goToPreviousVerse(true, updateProjectionWithHistory)
}

// 下一節 (影響投影)
const goToNextVerseProjection = () => {
  goToNextVerse(true, updateProjectionWithHistory)
}

// 更新投影字型大小
const handleFontSizeUpdate = () => {
  setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE), fontSize.value)
  updateFontSize(fontSize.value)
}

// 歷史記錄相關函數
const loadVerse = async (item: VerseItem, type: 'history' | 'custom') => {
  try {
    const versionId = currentVersion.value?.id
    if (!versionId) {
      reportError(new Error('No Bible version selected'), {
        operation: 'load-verse',
        component: 'BibleControl',
        extra: { item },
      })
      return
    }

    const content = await getBibleContent(versionId)
    if (!content) {
      reportError(new Error('Bible content not found'), {
        operation: 'load-verse',
        component: 'BibleControl',
        extra: { versionId, item },
      })
      return
    }

    // 找到對應的書卷
    const book = content.books.find((b) => b.number === item.bookNumber)
    if (!book) {
      reportError(new Error('Book not found'), {
        operation: 'load-verse',
        component: 'BibleControl',
        extra: { versionId, bookNumber: item.bookNumber, item },
      })
      return
    }

    handleVerseSelection(book, item.chapter, item.verse)

    if (type === 'custom') {
      updateProjectionWithHistory(item.verse)
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

// 監聽來自ExtendedToolbar的事件（通過全局事件或props）
onMounted(() => {
  // 載入儲存的數據（rootFolder 已包含在 store 中，會自動遷移舊格式）
  loadRootFolder()

  // 監聽經文選擇事件
  const eventHandler = (event: Event) => {
    const customEvent = event as CustomEvent
    const { book, chapter, verse } = customEvent.detail
    handleVerseSelection(book, chapter, verse)
  }

  window.addEventListener('bible-verse-selected', eventHandler)
  document.addEventListener('keydown', handleKeydown)

  onUnmounted(() => {
    window.removeEventListener('bible-verse-selected', eventHandler)
    document.removeEventListener('keydown', handleKeydown)
  })
})
</script>

<style scoped>
.bible-content-wrapper {
  flex: 1;
  overflow-y: auto;
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
  min-width: 24px;
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
</style>
