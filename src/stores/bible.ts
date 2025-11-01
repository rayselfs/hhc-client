import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MultiFunctionVerse } from '@/types/bible'

export const useBibleStore = defineStore('bible', () => {
  // History verses - 不持久化，重開 app 就消失
  const historyVerses = ref<MultiFunctionVerse[]>([])

  /**
   * 添加經文到歷史記錄
   */
  const addToHistory = (verse: MultiFunctionVerse) => {
    // 檢查是否已存在相同的記錄（同一章節）
    const existingIndex = historyVerses.value.findIndex(
      (item) =>
        item.bookNumber === verse.bookNumber &&
        item.chapter === verse.chapter &&
        item.verse === verse.verse,
    )

    if (existingIndex !== -1) {
      // 如果已存在，移除舊的記錄
      historyVerses.value.splice(existingIndex, 1)
    }

    // 添加新記錄到開頭
    historyVerses.value.unshift(verse)

    // 限制歷史記錄數量（最多 50 條）
    if (historyVerses.value.length > 50) {
      historyVerses.value.shift()
    }
  }

  /**
   * 清空歷史記錄
   */
  const clearHistory = () => {
    historyVerses.value = []
  }

  return {
    historyVerses,
    addToHistory,
    clearHistory,
  }
})
