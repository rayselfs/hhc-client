import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

// API 基礎 URL
const API_BASE_URL = 'http://localhost:8080/api/bible'

// 類型定義
export interface BibleVersion {
  id: number
  code: string
  name: string
}

export interface BibleBook {
  id: number
  number: number
  name: string
  abbreviation: string
  chapters: BibleChapter[]
}

export interface BibleChapter {
  id: number
  number: number
  verses: BibleVerse[]
}

export interface BibleVerse {
  id: number
  number: number
  text: string
}

export interface BibleContent {
  version_id: number
  version_code: string
  version_name: string
  books: BibleBook[]
}

export const useBibleStore = defineStore('bible', () => {
  // 狀態
  const versions = ref<BibleVersion[]>([])
  const currentVersion = ref<BibleVersion | null>(null)
  const bibleContent = ref<BibleContent | null>(null)
  const selectedBook = ref<BibleBook | null>(null)
  const selectedChapter = ref<BibleChapter | null>(null)
  const selectedVerse = ref<BibleVerse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 計算屬性
  const oldTestamentBooks = computed(() => {
    if (!bibleContent.value) return []
    return bibleContent.value.books.filter((book) => book.number <= 39)
  })

  const newTestamentBooks = computed(() => {
    if (!bibleContent.value) return []
    return bibleContent.value.books.filter((book) => book.number > 39)
  })

  const currentVerses = computed(() => {
    return selectedChapter.value?.verses || []
  })

  // 方法
  const fetchVersions = async () => {
    try {
      isLoading.value = true
      error.value = null
      const response = await axios.get(`${API_BASE_URL}/versions`)
      versions.value = response.data
    } catch (err) {
      error.value = '無法載入聖經版本列表'
      console.error('Error fetching versions:', err)
    } finally {
      isLoading.value = false
    }
  }

  const fetchBibleContent = async (versionId: number) => {
    try {
      isLoading.value = true
      error.value = null
      const response = await axios.get(`${API_BASE_URL}/version/${versionId}`)
      bibleContent.value = response.data

      // 保存到 localStorage
      localStorage.setItem(`bible_content_${versionId}`, JSON.stringify(response.data))
    } catch (err) {
      error.value = '無法載入聖經內容'
      console.error('Error fetching bible content:', err)
    } finally {
      isLoading.value = false
    }
  }

  const loadBibleContentFromStorage = (versionId: number) => {
    const stored = localStorage.getItem(`bible_content_${versionId}`)
    if (stored) {
      try {
        bibleContent.value = JSON.parse(stored)
        return true
      } catch (err) {
        console.error('Error parsing stored bible content:', err)
        localStorage.removeItem(`bible_content_${versionId}`)
      }
    }
    return false
  }

  const selectVersion = async (version: BibleVersion) => {
    currentVersion.value = version

    // 先嘗試從 localStorage 載入
    if (!loadBibleContentFromStorage(version.id)) {
      // 如果沒有快取，則從 API 載入
      await fetchBibleContent(version.id)
    }

    // 重置選擇
    selectedBook.value = null
    selectedChapter.value = null
    selectedVerse.value = null
  }

  const selectBook = (book: BibleBook) => {
    selectedBook.value = book
    selectedChapter.value = null
    selectedVerse.value = null
  }

  const selectChapter = (chapter: BibleChapter) => {
    selectedChapter.value = chapter
    selectedVerse.value = null
  }

  const selectVerse = (verse: BibleVerse) => {
    selectedVerse.value = verse
  }

  const resetSelection = () => {
    selectedBook.value = null
    selectedChapter.value = null
    selectedVerse.value = null
  }

  // 初始化
  const initialize = async () => {
    await fetchVersions()
  }

  return {
    // 狀態
    versions,
    currentVersion,
    bibleContent,
    selectedBook,
    selectedChapter,
    selectedVerse,
    isLoading,
    error,

    // 計算屬性
    oldTestamentBooks,
    newTestamentBooks,
    currentVerses,

    // 方法
    fetchVersions,
    fetchBibleContent,
    selectVersion,
    selectBook,
    selectChapter,
    selectVerse,
    resetSelection,
    initialize,
  }
})
