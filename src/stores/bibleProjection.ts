import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import {
  StorageCategory,
  StorageKey,
  getStorageKey,
  type AppMessage,
  MessageType,
} from '@/types/common'
import { BIBLE_CONFIG } from '@/config/app'

export const useBibleProjectionStore = defineStore('bibleProjection', () => {
  const { getLocalItem } = useLocalStorage()

  const selectedBook = ref('創世記')
  const selectedBookNumber = ref(1)
  const selectedChapter = ref(1)
  const chapterVerses = ref<Array<{ number: number; text: string }>>([])
  const currentVerse = ref(1)
  const isMultiVersion = ref(false)
  const secondVersionChapterVerses = ref<Array<{ number: number; text: string }>>([])

  const getInitialFontSize = () => {
    const savedFontSize = getLocalItem<number>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
      'int',
    )
    return savedFontSize ? savedFontSize : BIBLE_CONFIG.FONT.DEFAULT_SIZE
  }

  const verseFontSize = ref(getInitialFontSize())

  // Actions
  const setBibleContent = (data: {
    bookNumber: number
    chapter: number
    chapterVerses: Array<{ number: number; text: string }>
    currentVerse: number
    isMultiVersion?: boolean
    secondVersionChapterVerses?: Array<{ number: number; text: string }>
  }) => {
    selectedBookNumber.value = data.bookNumber
    selectedChapter.value = data.chapter
    chapterVerses.value = data.chapterVerses
    currentVerse.value = data.currentVerse
    isMultiVersion.value = !!data.isMultiVersion
    secondVersionChapterVerses.value = data.secondVersionChapterVerses || []

    // Note: selectedBook (string name) might need to be derived or passed if available.
    // The message currently passes 'bookNumber' and 'chapter'.
    // If 'book' name is not passed in UPDATE_BIBLE, we might need to look it up or rely on what's passed.
    // Looking at previous code: `selectedBook` ref was initialized but seemingly not updated in UPDATE_BIBLE case?
    // Wait, let me check the previous `handleMessage` code.
  }

  const setFontSize = (size: number) => {
    verseFontSize.value = size
  }

  /**
   * 處理聖經投影消息
   */
  const handleMessage = (message: AppMessage): boolean => {
    switch (message.type) {
      case MessageType.BIBLE_SYNC_CONTENT:
        if ('bookNumber' in message.data) {
          setBibleContent({
            bookNumber: message.data.bookNumber,
            chapter: message.data.chapter,
            chapterVerses: message.data.chapterVerses,
            currentVerse: message.data.currentVerse,
            isMultiVersion: message.data.isMultiVersion,
            secondVersionChapterVerses: message.data.secondVersionChapterVerses,
          })
          return true
        }
        break

      case MessageType.BIBLE_UPDATE_FONT_SIZE:
        if ('fontSize' in message.data) {
          setFontSize(Number(message.data.fontSize))
          return true
        }
        break
    }
    return false
  }

  return {
    selectedBook,
    selectedBookNumber,
    selectedChapter,
    chapterVerses,
    currentVerse,
    isMultiVersion,
    secondVersionChapterVerses,
    verseFontSize,

    setBibleContent,
    setFontSize,
    handleMessage,
  }
})
