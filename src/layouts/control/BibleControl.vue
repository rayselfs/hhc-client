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
                @click="goToPreviousChapter"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
              <v-btn
                size="small"
                :disabled="currentPassage.chapter >= getMaxChapters()"
                @click="goToNextChapter"
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
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6" class="pl-2 pt-4 pb-4 pr-4" ref="rightColumnContainer">
        <v-row no-gutters class="fill-height">
          <!-- Multi Function Control -->
          <v-col cols="12" class="mb-4" :style="{ height: `${rightTopCardHeight}px` }">
            <MultiFunctionControl
              ref="multiFunctionControlRef"
              v-model:custom-folders="customFolders"
              v-model:current-folder-path="currentFolderPath"
              v-model:current-folder="currentFolder"
              :container-height="rightTopCardHeight"
              @load-verse="loadVerse"
            />
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
                      @update:model-value="updateProjectionFontSize"
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
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useProjectionStore } from '@/stores/projection'
import { useBibleStore } from '@/stores/bible'
import { APP_CONFIG } from '@/config/app'
import { MessageType, ViewType } from '@/types/common'
import { useSentry } from '@/composables/useSentry'
import { useCardLayout } from '@/composables/useLayout'
import { useLocalStorage } from '@/composables/useLocalStorage'
import ContextMenu from '@/components/ContextMenu.vue'
import MultiFunctionControl from '@/components/Bible/MultiFunctionControl.vue'

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
const { isElectron } = useElectron()
const { setProjectionState, sendBibleUpdate } = useProjectionMessaging()
const projectionStore = useProjectionStore()
const { sendToProjection } = useElectron()
const { reportError } = useSentry()
const { getLocalItem, setLocalItem } = useLocalStorage()

// 使用 Bible Store（包含 Cache 功能）
const bibleStore = useBibleStore()
const { getBibleContent } = bibleStore

// MultiFunctionControl ref（用於添加 history）
const multiFunctionControlRef = ref<InstanceType<typeof MultiFunctionControl> | null>(null)

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

// 歷史記錄
import type { MultiFunctionVerse } from '@/types/bible'
import { BIBLE_CONFIG } from '@/config/app'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'

// 自訂資料夾
interface CustomFolder {
  id: string
  name: string
  expanded: boolean
  items: MultiFunctionVerse[]
  folders: CustomFolder[]
  parentId?: string
}

const customFolders = ref<CustomFolder[]>([])
const currentFolderPath = ref<string[]>([]) // 當前資料夾路徑
const currentFolder = ref<CustomFolder | null>(null) // 當前所在的資料夾

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

// 滾動到指定節
const scrollToVerse = (verseNumber: number) => {
  const element = document.querySelector(`[data-verse="${verseNumber}"]`)
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth', // 'instant'
      block: 'start',
    })
  }
}

// 更新投影畫面
const updateProjection = async (verseNumber: number) => {
  if (currentPassage.value) {
    if (isElectron()) {
      // 如果投影視窗沒有顯示聖經（顯示預設內容或顯示其他內容），則切換到聖經
      if (projectionStore.isShowingDefault || projectionStore.currentView !== 'bible') {
        await setProjectionState(false, ViewType.BIBLE)
      }
    }

    // 發送聖經數據
    const bibleData = {
      book: currentPassage.value.bookName,
      bookNumber: currentPassage.value.bookNumber,
      chapter: currentPassage.value.chapter,
      chapterVerses: chapterVerses.value.map((verse) => ({
        number: verse.number,
        text: verse.text,
      })),
      currentVerse: verseNumber,
    }

    sendBibleUpdate(bibleData, true)

    addToHistory(verseNumber)
  }
}

/**
 * 創建 MultiFunctionVerse 物件
 * @param verseNumber - 節號
 * @returns MultiFunctionVerse 物件，如果 currentPassage 不存在則返回 null
 */
const createMultiFunctionVerse = (verseNumber: number): MultiFunctionVerse | null => {
  if (!currentPassage.value) return null

  const verseText = chapterVerses.value.find((v) => v.number === verseNumber)?.text || ''

  return {
    id: crypto.randomUUID(),
    bookAbbreviation: currentPassage.value.bookAbbreviation,
    bookNumber: currentPassage.value.bookNumber,
    chapter: currentPassage.value.chapter,
    verse: verseNumber,
    verseText,
    timestamp: Date.now(),
  }
}

// 添加到歷史記錄（通過 MultiFunctionControl 的方法）
const addToHistory = (verseNumber: number) => {
  if (!currentPassage.value) return

  const newHistoryItem = createMultiFunctionVerse(verseNumber)
  if (!newHistoryItem) return

  // 通過 MultiFunctionControl 的 ref 添加歷史記錄
  if (multiFunctionControlRef.value) {
    multiFunctionControlRef.value.addToHistory(newHistoryItem)
  }
}

// 點擊選擇經文
const selectVerse = (verseNumber: number) => {
  if (currentPassage.value) {
    currentPassage.value.verse = verseNumber
    updateProjection(verseNumber)
  }
}

// 獲取最大章數
const getMaxChapters = () => {
  return currentBookData.value ? currentBookData.value.chapters.length : 0
}

// 上一章 (只影響預覽)
const goToPreviousChapter = () => {
  if (currentPassage.value && currentPassage.value.chapter > 1 && currentBookData.value) {
    const newChapter = currentPassage.value.chapter - 1
    const selectedChapter = currentBookData.value.chapters.find((ch) => ch.number === newChapter)

    if (selectedChapter) {
      // 更新章節和節數（從第1節開始）
      currentPassage.value.chapter = newChapter
      currentPassage.value.verse = 1

      // 更新經文內容
      chapterVerses.value = selectedChapter.verses.map((v: { number: number; text: string }) => ({
        number: v.number,
        text: v.text,
      }))

      // 滾動到第1節
      nextTick(() => {
        scrollToVerse(1)
      })
    }
  }
}

// 下一章 (只影響預覽)
const goToNextChapter = () => {
  if (currentPassage.value && currentBookData.value) {
    const maxChapters = getMaxChapters()
    if (currentPassage.value.chapter < maxChapters) {
      const newChapter = currentPassage.value.chapter + 1
      const selectedChapter = currentBookData.value.chapters.find((ch) => ch.number === newChapter)

      if (selectedChapter) {
        // 更新章節和節數（從第1節開始）
        currentPassage.value.chapter = newChapter
        currentPassage.value.verse = 1

        // 更新經文內容
        chapterVerses.value = selectedChapter.verses.map((v: { number: number; text: string }) => ({
          number: v.number,
          text: v.text,
        }))

        // 滾動到第1節
        nextTick(() => {
          scrollToVerse(1)
        })
      }
    }
  }
}

// 投影控制函數
// 上一章 (影響投影)
const goToPreviousChapterProjection = () => {
  if (currentPassage.value && currentPassage.value.chapter > 1 && currentBookData.value) {
    const newChapter = currentPassage.value.chapter - 1
    const selectedChapter = currentBookData.value.chapters.find((ch) => ch.number === newChapter)

    if (selectedChapter) {
      // 更新章節和節數（從第1節開始）
      currentPassage.value.chapter = newChapter
      currentPassage.value.verse = 1

      // 更新經文內容
      chapterVerses.value = selectedChapter.verses.map((v: { number: number; text: string }) => ({
        number: v.number,
        text: v.text,
      }))

      // 滾動到第1節
      nextTick(() => {
        scrollToVerse(1)
      })

      // 發送到投影
      updateProjection(1)
    }
  }
}

// 下一章 (影響投影)
const goToNextChapterProjection = () => {
  if (currentPassage.value && currentBookData.value) {
    const maxChapters = getMaxChapters()
    if (currentPassage.value.chapter < maxChapters) {
      const newChapter = currentPassage.value.chapter + 1
      const selectedChapter = currentBookData.value.chapters.find((ch) => ch.number === newChapter)

      if (selectedChapter) {
        // 更新章節和節數（從第1節開始）
        currentPassage.value.chapter = newChapter
        currentPassage.value.verse = 1

        // 更新經文內容
        chapterVerses.value = selectedChapter.verses.map((v: { number: number; text: string }) => ({
          number: v.number,
          text: v.text,
        }))

        // 滾動到第1節
        nextTick(() => {
          scrollToVerse(1)
        })

        // 發送到投影
        updateProjection(1)
      }
    }
  }
}

// 上一節 (影響投影)
const goToPreviousVerseProjection = () => {
  if (currentPassage.value && currentPassage.value.verse > 1) {
    const newVerse = currentPassage.value.verse - 1
    currentPassage.value.verse = newVerse

    // 滾動到新節
    nextTick(() => {
      scrollToVerse(newVerse)
    })

    // 發送到投影
    updateProjection(newVerse)
  }
}

// 下一節 (影響投影)
const goToNextVerseProjection = () => {
  if (currentPassage.value && currentPassage.value.verse < chapterVerses.value.length) {
    const newVerse = currentPassage.value.verse + 1
    currentPassage.value.verse = newVerse

    // 滾動到新節
    nextTick(() => {
      scrollToVerse(newVerse)
    })

    // 發送到投影
    updateProjection(newVerse)
  }
}

// 更新投影字型大小
const updateProjectionFontSize = () => {
  setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE), fontSize.value)
  if (isElectron()) {
    sendToProjection({
      type: MessageType.UPDATE_BIBLE_FONT_SIZE,
      data: { fontSize: fontSize.value },
    })
  }
}

// 歷史記錄相關函數
const loadVerse = async (item: MultiFunctionVerse, type: 'history' | 'custom') => {
  try {
    // 獲取當前選中的版本
    const savedVersion = getLocalItem<number>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION),
    )
    const versionId = savedVersion ? savedVersion : 1

    const content = await getBibleContent(versionId)
    if (content) {
      // 找到對應的書卷
      const book = content.books.find((b) => b.number === item.bookNumber)
      if (book) {
        handleVerseSelection(book, item.chapter, item.verse)
      }
    }

    if (type === 'custom') {
      updateProjection(item.verse)
    }
  } catch (error) {
    reportError(error, {
      operation: 'load-history-verse',
      component: 'BibleControl',
      extra: { verseId: item.id },
    })
  }
}

const addVerseToCustom = (verseNumber: number) => {
  if (!currentPassage.value) return

  const newVerse = createMultiFunctionVerse(verseNumber)
  if (!newVerse) return

  // 基於當前顯示的位置添加經文
  if (currentFolder.value) {
    // 檢查是否已存在相同的經文
    const exists = currentFolder.value.items.some(
      (item) =>
        item.bookNumber === newVerse.bookNumber &&
        item.chapter === newVerse.chapter &&
        item.verse === newVerse.verse,
    )
    if (!exists) {
      currentFolder.value.items.push(newVerse)
    }
  } else {
    let homepageFolder = customFolders.value.find((folder) => folder.id === 'homepage')

    if (!homepageFolder) {
      homepageFolder = {
        id: 'homepage',
        name: 'Homepage',
        expanded: false,
        items: [],
        folders: [],
      }
      customFolders.value.push(homepageFolder)
    }

    const exists = homepageFolder.items.some(
      (item) =>
        item.bookNumber === newVerse.bookNumber &&
        item.chapter === newVerse.chapter &&
        item.verse === newVerse.verse,
    )
    if (!exists) {
      homepageFolder.items.push(newVerse)
    }
  }
}

const saveCustomToStorage = () => {
  setLocalItem(
    getStorageKey(StorageCategory.BIBLE, StorageKey.CUSTOM_FOLDERS),
    customFolders.value,
    'array',
  )
}

const loadCustomFromStorage = () => {
  const saved = getLocalItem<CustomFolder[]>(
    getStorageKey(StorageCategory.BIBLE, StorageKey.CUSTOM_FOLDERS),
    'array',
  )
  if (saved) {
    customFolders.value = saved
  }
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

// 監聽 customFolders 變化並自動保存
watch(
  customFolders,
  () => {
    saveCustomToStorage()
  },
  { deep: true },
)

// 監聽來自ExtendedToolbar的事件（通過全局事件或props）
onMounted(() => {
  // 載入儲存的數據（只有 customFolders 需要持久化，history 使用 store 管理）
  loadCustomFromStorage()

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
