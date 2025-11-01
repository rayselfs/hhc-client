import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MultiFunctionVerse, BibleCacheItem, BibleContent } from '@/types/bible'
import { BibleCacheConfig } from '@/types/bible'
import { useIndexedDB } from '@/composables/useIndexedDB'

export const useBibleStore = defineStore('bible', () => {
  // History verses - 不持久化，重開 app 就消失
  const historyVerses = ref<MultiFunctionVerse[]>([])

  // 使用通用的 IndexedDB
  const bibleCacheDB = useIndexedDB({
    dbName: BibleCacheConfig.DB_NAME as string,
    version: BibleCacheConfig.DB_VERSION as number,
    stores: [
      {
        name: BibleCacheConfig.STORE_NAME as string,
        keyPath: 'versionId',
      },
    ],
  })

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

  /**
   * 儲存聖經內容到 IndexedDB
   * @param versionId - 版本 ID
   * @param versionCode - 版本代碼
   * @param versionName - 版本名稱
   * @param content - 聖經內容
   */
  const saveBibleContent = async (
    versionId: number,
    versionCode: string,
    versionName: string,
    content: BibleContent,
  ): Promise<void> => {
    await bibleCacheDB.put<BibleCacheItem>(BibleCacheConfig.STORE_NAME, {
      versionId,
      versionCode,
      versionName,
      content,
      timestamp: Date.now(),
    })
  }

  /**
   * 從 IndexedDB 讀取聖經內容
   * @param versionId - 版本 ID
   * @returns 聖經內容，如果不存在則返回 null
   */
  const getBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    const cached = await bibleCacheDB.get<BibleCacheItem>(BibleCacheConfig.STORE_NAME, versionId)
    return cached?.content ?? null
  }

  /**
   * 檢查特定版本的聖經內容是否已快取
   * @param versionId - 版本 ID
   * @returns 是否已快取
   */
  const hasCachedContent = async (versionId: number): Promise<boolean> => {
    return await bibleCacheDB.has(BibleCacheConfig.STORE_NAME, versionId)
  }

  return {
    // History
    historyVerses,
    addToHistory,
    clearHistory,
    // Bible Content
    saveBibleContent,
    getBibleContent,
    hasCachedContent,
  }
})
