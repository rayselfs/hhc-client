<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Preview -->
      <v-col cols="6" class="pl-4 pt-4 pb-4 pr-2" ref="leftColumnContainer">
        <v-card class="display-flex flex-column" :style="{ height: `${previewHeight}px` }">
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
            class="bible-content-wrapper pl-3 pr-3"
            :style="{ height: `${previewHeight - 80}px` }"
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
          <v-col cols="12" class="mb-4" :style="{ height: `${multiFunctionHeight}px` }">
            <MultiFunctionControl
              v-model:history-verses="historyVerses"
              v-model:custom-folders="customFolders"
              v-model:current-folder-path="currentFolderPath"
              v-model:current-folder="currentFolder"
              :container-height="multiFunctionHeight"
              @load-history-verse="loadHistoryVerse"
              @load-custom-verse="loadCustomVerse"
            />
          </v-col>

          <!-- Projection Control -->
          <v-col cols="12" :style="{ height: `${projectionHeight}px` }">
            <v-card :style="{ height: `${projectionHeight}px` }">
              <v-card-text>
                <!-- Chapter/Verse Navigation -->
                <v-row class="mb-3">
                  <v-col cols="6">
                    <v-label class="text-body-2">{{ $t('control') + $t('bible.chapter') }}</v-label>
                  </v-col>
                  <v-col cols="6">
                    <v-label class="text-body-2">{{ $t('control') + $t('bible.verse') }}</v-label>
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
                    <v-label class="text-body-2 mb-2">{{ $t('control') + $t('fontSize') }}</v-label>
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
        <v-list-item @click="copyVerseText">
          <template #prepend>
            <v-icon>mdi-content-copy</v-icon>
          </template>
          <v-list-item-title>{{ $t('copy') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useBibleCache } from '@/composables/useBibleCache'
import { useProjectionStore } from '@/stores/projection'
import { MessageType, ViewType } from '@/types/common'
import MultiFunctionControl from '@/components/Bible/MultiFunctionControl.vue'

interface BiblePassage {
  bookAbbreviation: string
  bookName: string
  bookNumber: number
  chapter: number
  verse: number
  versionId?: number
}

interface BibleVerse {
  number: number
  text: string
}

const { t: $t } = useI18n()
const { isElectron } = useElectron()
const { setProjectionState, sendBibleUpdate } = useProjectionMessaging()
const projectionStore = useProjectionStore()
const { sendToProjection } = useElectron()
const { getBibleContent } = useBibleCache()

// 當前選中的經文
const currentPassage = ref<BiblePassage | null>(null)
const chapterVerses = ref<BibleVerse[]>([])
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
  const savedFontSize = localStorage.getItem(getBibleLocalKey(STORAGE_KEYS.BIBLE_LOCAL.FONT_SIZE))
  const fontSize = savedFontSize ? parseInt(savedFontSize, 10) : getDefaultFontSize()
  return isValidFontSize(fontSize) ? fontSize : getDefaultFontSize()
}
const fontSize = ref(getInitialFontSize())

// 歷史記錄
import type { Verse } from '@/types/verse'
import {
  getDefaultFontSize,
  getBibleLocalKey,
  getBibleSessionKey,
  isValidFontSize,
  BIBLE_CONFIG,
  STORAGE_KEYS,
} from '@/config/app'

const historyVerses = ref<Verse[]>([])

// 自訂資料夾
interface CustomFolder {
  id: string
  name: string
  expanded: boolean
  items: Verse[]
  folders: CustomFolder[]
  parentId?: string
}

const customFolders = ref<CustomFolder[]>([])
const currentFolderPath = ref<string[]>([]) // 當前資料夾路徑
const currentFolder = ref<CustomFolder | null>(null) // 當前所在的資料夾

// 容器引用和高度計算
const previewHeight = ref<number>(600)
const multiFunctionHeight = ref<number>(400)
const projectionHeight = ref<number>(200)

// 右鍵選單相關
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const selectedVerse = ref<{ number: number; text: string } | null>(null)

// 計算三個卡片的高度
const calculateHeights = () => {
  // 計算 Preview card 高度：100vh - 96px
  const viewportHeight = window.innerHeight
  previewHeight.value = viewportHeight - 96

  // 右邊兩個卡片根據 Preview card 高度分配
  const gap = 16 // mb-4 的間距 (16px)

  // Multi Function Control 佔 70%，Projection Control 佔 30%
  multiFunctionHeight.value = Math.floor((previewHeight.value - gap) * 0.7)
  projectionHeight.value = Math.floor((previewHeight.value - gap) * 0.3)
}

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
    // 只在投影視窗沒有顯示聖經時才切換
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

// 添加到歷史記錄
const addToHistory = (verseNumber: number) => {
  if (!currentPassage.value) return

  const verseText = chapterVerses.value.find((v) => v.number === verseNumber)?.text || ''

  const newHistoryItem: Verse = {
    id: crypto.randomUUID(),
    bookName: currentPassage.value.bookName,
    bookAbbreviation: currentPassage.value.bookAbbreviation,
    bookNumber: currentPassage.value.bookNumber,
    chapter: currentPassage.value.chapter,
    verse: verseNumber,
    verseText,
    timestamp: Date.now(),
  }

  // ignore the same chapter
  const lastHistory = historyVerses.value[0]
  if (
    lastHistory &&
    lastHistory.bookNumber === newHistoryItem.bookNumber &&
    lastHistory.chapter === newHistoryItem.chapter
  ) {
    return
  }

  // update the same chapter
  const existingIndex = historyVerses.value.findIndex(
    (item) =>
      item.bookNumber === newHistoryItem.bookNumber &&
      item.chapter === newHistoryItem.chapter &&
      item.verse === newHistoryItem.verse,
  )
  if (existingIndex !== -1) {
    historyVerses.value.splice(existingIndex, 1)
  }

  // add new history item to the top
  historyVerses.value.unshift(newHistoryItem)

  // limit the history items
  if (historyVerses.value.length > 50) {
    historyVerses.value.shift()
  }

  // 保存到 localStorage
  saveHistoryToStorage()
}

// 點擊選擇經文
const selectVerse = (verseNumber: number) => {
  if (currentPassage.value) {
    currentPassage.value.verse = verseNumber

    // 不滾動，只發送到投影
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
  // 保存字型大小到 localStorage
  localStorage.setItem(
    getBibleLocalKey(STORAGE_KEYS.BIBLE_LOCAL.FONT_SIZE),
    fontSize.value.toString(),
  )

  // 發送字型大小更新到投影
  if (isElectron()) {
    sendToProjection({
      type: MessageType.UPDATE_BIBLE_FONT_SIZE,
      data: { fontSize: fontSize.value },
    })
  }
}

// 歷史記錄相關函數
const loadHistoryVerse = async (item: Verse) => {
  try {
    // 獲取當前選中的版本
    const savedVersion = localStorage.getItem(
      getBibleLocalKey(STORAGE_KEYS.BIBLE_LOCAL.SELECTED_VERSION),
    )
    const versionId = savedVersion ? parseInt(savedVersion) : 1

    const content = await getBibleContent(versionId)
    if (content) {
      // 找到對應的書卷
      const book = content.books.find((b) => b.number === item.bookNumber)
      if (book) {
        handleVerseSelection(book, item.chapter, item.verse)
      }
    }
  } catch (error) {
    console.error('Error loading history verse:', error)
  }
}

const saveHistoryToStorage = () => {
  sessionStorage.setItem(
    getBibleSessionKey(STORAGE_KEYS.BIBLE_SESSION.CURRENT_PASSAGE),
    JSON.stringify(historyVerses.value),
  )
}

const loadHistoryFromStorage = () => {
  const saved = sessionStorage.getItem(
    getBibleSessionKey(STORAGE_KEYS.BIBLE_SESSION.CURRENT_PASSAGE),
  )
  if (saved) {
    historyVerses.value = JSON.parse(saved)
  }
}

const addVerseToCustom = (verseNumber: number) => {
  if (!currentPassage.value) return

  // 獲取經文內容
  const verseText = chapterVerses.value.find((v) => v.number === verseNumber)?.text || ''

  const newVerse: Verse = {
    id: crypto.randomUUID(),
    bookName: currentPassage.value.bookName,
    bookAbbreviation: currentPassage.value.bookAbbreviation,
    bookNumber: currentPassage.value.bookNumber,
    chapter: currentPassage.value.chapter,
    verse: verseNumber,
    verseText,
    timestamp: Date.now(),
  }

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

const loadCustomVerse = async (item: Verse) => {
  try {
    // 獲取當前選中的版本
    const savedVersion = localStorage.getItem(
      getBibleLocalKey(STORAGE_KEYS.BIBLE_LOCAL.SELECTED_VERSION),
    )
    const versionId = savedVersion ? parseInt(savedVersion) : 1

    const content = await getBibleContent(versionId)
    if (content) {
      // 找到對應的書卷
      const book = content.books.find((b) => b.number === item.bookNumber)
      if (book) {
        handleVerseSelection(book, item.chapter, item.verse)
      }
    }
  } catch (error) {
    console.error('Error loading custom verse:', error)
  }
}

const saveCustomToStorage = () => {
  localStorage.setItem(
    getBibleLocalKey(STORAGE_KEYS.BIBLE_LOCAL.CUSTOM_FOLDERS),
    JSON.stringify(customFolders.value),
  )
}

const loadCustomFromStorage = () => {
  const saved = localStorage.getItem(getBibleLocalKey(STORAGE_KEYS.BIBLE_LOCAL.CUSTOM_FOLDERS))
  if (saved) {
    customFolders.value = JSON.parse(saved)
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
  event.preventDefault()
  event.stopPropagation()

  // 如果選單已經顯示，先關閉它
  if (showContextMenu.value) {
    showContextMenu.value = false
    // 使用 nextTick 確保選單完全關閉後再顯示新的選單
    nextTick(() => {
      selectedVerse.value = verse
      contextMenuX.value = event.clientX
      contextMenuY.value = event.clientY
      showContextMenu.value = true
    })
  } else {
    // 如果選單沒有顯示，直接顯示新選單
    selectedVerse.value = verse
    contextMenuX.value = event.clientX
    contextMenuY.value = event.clientY
    showContextMenu.value = true
  }
}

const closeContextMenu = () => {
  showContextMenu.value = false
  selectedVerse.value = null
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

const copyVerseText = async () => {
  if (selectedVerse.value && currentPassage.value) {
    const verseText = `${currentPassage.value.bookName} ${currentPassage.value.chapter}:${selectedVerse.value.number} ${selectedVerse.value.text}`

    try {
      await navigator.clipboard.writeText(verseText)
      // 可以添加一個提示訊息
    } catch (err) {
      console.error('複製失敗:', err)
      // 降級方案：使用舊的複製方法
      const textArea = document.createElement('textarea')
      textArea.value = verseText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }
  closeContextMenu()
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
  // 載入儲存的數據
  loadHistoryFromStorage()
  loadCustomFromStorage()

  // 監聽經文選擇事件
  const eventHandler = (event: Event) => {
    const customEvent = event as CustomEvent
    const { book, chapter, verse } = customEvent.detail
    handleVerseSelection(book, chapter, verse)
  }

  window.addEventListener('bible-verse-selected', eventHandler)
  document.addEventListener('keydown', handleKeydown)

  // 計算初始高度
  nextTick(() => {
    calculateHeights()
  })

  // 監聽窗口大小變化
  window.addEventListener('resize', calculateHeights)

  // 監聽點擊事件來關閉右鍵選單，使用捕獲階段
  document.addEventListener('click', handleDocumentClick, true)

  onUnmounted(() => {
    window.removeEventListener('bible-verse-selected', eventHandler)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', calculateHeights)
    document.removeEventListener('click', handleDocumentClick, true)
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
