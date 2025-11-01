import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MultiFunctionVerse, BibleCacheItem, BibleContent } from '@/types/bible'
import { BibleCacheConfig } from '@/types/bible'
import { useIndexedDB } from '@/composables/useIndexedDB'

export const useBibleStore = defineStore('bible', () => {
  const historyVerses = ref<MultiFunctionVerse[]>([])
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
   * Add verse to history
   */
  const addToHistory = (verse: MultiFunctionVerse) => {
    // Check if the verse already exists in the history
    const existingIndex = historyVerses.value.findIndex(
      (item) =>
        item.bookNumber === verse.bookNumber &&
        item.chapter === verse.chapter &&
        item.verse === verse.verse,
    )

    if (existingIndex !== -1) {
      // If it already exists, remove the old record
      historyVerses.value.splice(existingIndex, 1)
    }

    // Add new record to the beginning
    historyVerses.value.unshift(verse)

    // Limit the history record count (maximum 50 records)
    if (historyVerses.value.length > 50) {
      historyVerses.value.shift()
    }
  }

  /**
   * Clear history
   */
  const clearHistory = () => {
    historyVerses.value = []
  }

  /**
   * Save Bible content to IndexedDB
   * @param versionId - version ID
   * @param versionCode - version code
   * @param versionName - version name
   * @param content - Bible content
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
   * Get Bible content from IndexedDB
   * @param versionId - version ID
   * @returns Bible content, if not exists, return null
   */
  const getBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    const cached = await bibleCacheDB.get<BibleCacheItem>(BibleCacheConfig.STORE_NAME, versionId)
    return cached?.content ?? null
  }

  /**
   * Check if the Bible content for a specific version is cached
   * @param versionId - version ID
   * @returns true if cached, false otherwise
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
