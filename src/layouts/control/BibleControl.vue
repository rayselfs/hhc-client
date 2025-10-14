<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Preview -->
      <v-col cols="6" class="pl-4 pt-4 pb-4 pr-2">
        <v-card class="bible-card">
          <v-card-title class="text-h5 d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <span class="mr-1">{{ currentPassage?.bookName || $t('bible.verseTitle') }}</span>
              <v-chip v-if="currentPassage" color="primary">
                {{ currentPassage.bookCode }} {{ currentPassage.chapter }}:{{
                  currentPassage.verse
                }}
              </v-chip>
            </div>
            <div v-if="currentPassage" class="d-flex align-center gap-2">
              <v-btn
                class="mr-1"
                :disabled="currentPassage.chapter <= 1"
                @click="goToPreviousChapter"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
              <v-btn
                :disabled="currentPassage.chapter >= getMaxChapters()"
                @click="goToNextChapter"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </div>
          </v-card-title>

          <v-divider />

          <v-card-text class="bible-content-wrapper pl-3 pr-3">
            <div class="bible-content">
              <div
                v-for="verse in chapterVerses"
                :key="verse.number"
                :data-verse="verse.number"
                class="verse-item mb-2"
                :class="{
                  'verse-highlighted': currentPassage && verse.number === currentPassage.verse,
                }"
                @click="selectVerse(verse.number)"
              >
                <span class="verse-number text-h6">{{ verse.number }}</span>
                <span class="verse-text text-h6">{{ verse.text }}</span>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 右側控制區域 -->
      <v-col cols="6" class="pl-2 pt-4 pb-4 pr-4">
        <v-row no-gutters class="fill-height">
          <!-- 上層卡片 (2/3 高度) -->
          <v-col cols="12" class="mb-4" style="height: calc(66.67% - 8px)">
            <v-card class="fill-height">
              <v-card-title class="text-h6"> 預覽控制 </v-card-title>
              <v-card-text>
                <p class="text-body-2 text-grey">此區域預留給未來的功能</p>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- 下層卡片 (1/3 高度) -->
          <v-col cols="12" style="height: calc(33.33% - 8px)">
            <v-card class="fill-height">
              <v-card-text>
                <!-- 章節控制 -->
                <v-row class="mb-3">
                  <v-col cols="12">
                    <v-label class="text-body-2">{{ $t('control') }}</v-label>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-center">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.chapter <= 1"
                      @click="goToPreviousChapterProjection"
                    >
                      <v-icon>mdi-chevron-left</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-center">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.chapter >= getMaxChapters()"
                      @click="goToNextChapterProjection"
                    >
                      <v-icon>mdi-chevron-right</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-center">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.verse <= 1"
                      @click="goToPreviousVerseProjection"
                    >
                      <v-icon>mdi-chevron-up</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-center">
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

                <!-- 字型大小控制 -->
                <v-row>
                  <v-col cols="12">
                    <v-label class="text-body-2 mb-2">{{ $t('fontSize') }}</v-label>
                    <v-slider
                      v-model="fontSize"
                      :min="30"
                      :max="120"
                      :step="5"
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
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useProjectionStore } from '@/stores/projection'
import { MessageType, ViewType } from '@/types/common'

interface BiblePassage {
  bookCode: string
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
  // 從 localStorage 讀取上次設定的字型大小，如果沒有則使用預設值 90px
  const savedFontSize = localStorage.getItem('bible-font-size')
  return savedFontSize ? parseInt(savedFontSize, 10) : 90
}
const fontSize = ref(getInitialFontSize())

// 監聽來自父組件的經文選擇事件
const handleVerseSelection = (
  book: {
    code?: string
    number: number
    name: string
    chapters: Array<{ number: number; verses: Array<{ number: number; text: string }> }>
  },
  chapter: number,
  verse: number,
) => {
  currentPassage.value = {
    bookCode: book.code || '',
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
  }
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

      // 不發送到投影，只更新預覽
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

        // 不發送到投影，只更新預覽
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
  localStorage.setItem('bible-font-size', fontSize.value.toString())

  // 發送字型大小更新到投影
  if (isElectron()) {
    sendToProjection({
      type: MessageType.UPDATE_BIBLE_FONT_SIZE,
      data: { fontSize: fontSize.value },
    })
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

// 監聽來自ExtendedToolbar的事件（通過全局事件或props）
onMounted(() => {
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
.bible-card {
  height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
}

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

.verse-text {
  flex: 1;
  text-align: justify;
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
</style>
