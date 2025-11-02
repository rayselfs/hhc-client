import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BibleCacheItem, BibleContent, MultiFunctionVerse } from '@/types/bible'
import { BibleCacheConfig } from '@/types/bible'
import { useIndexedDB } from '@/composables/useIndexedDB'

export const useBibleStore = defineStore('bible', () => {
  /**
   * History of verses viewed by the user
   * Array of verses that have been accessed, limited to 50 items
   */
  const historyVerses = ref<MultiFunctionVerse[]>([])

  /**
   * Currently loaded Bible content in memory
   * Used to avoid redundant IndexedDB reads when the same version is accessed multiple times
   */
  const currentBibleContent = ref<{
    versionId: number
    content: BibleContent
  } | null>(null)

  /**
   * IndexedDB instance for Bible content cache
   * Stores Bible content by version ID for offline access
   */
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
   * Save Bible content to IndexedDB and update cache
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

    // Update in-memory cache
    currentBibleContent.value = {
      versionId,
      content,
    }
  }

  /**
   * Get Bible content from IndexedDB or in-memory cache
   * If the same version is already in memory, returns it directly to avoid redundant IndexedDB reads
   * @param versionId - The Bible version ID
   * @returns Bible content if exists, null otherwise
   */
  const getBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    // Check in-memory cache first
    if (currentBibleContent.value && currentBibleContent.value.versionId === versionId) {
      return currentBibleContent.value.content
    }

    // Read from IndexedDB if not in cache
    const cached = await bibleCacheDB.get<BibleCacheItem>(BibleCacheConfig.STORE_NAME, versionId)
    const content = cached?.content ?? null

    // Update in-memory cache
    if (content) {
      currentBibleContent.value = {
        versionId,
        content,
      }
    } else {
      currentBibleContent.value = null
    }

    return content
  }

  /**
   * Clear the currently loaded Bible content from memory
   * Useful when switching versions to free up memory
   */
  const clearCurrentBibleContent = () => {
    currentBibleContent.value = null
  }

  /**
   * Check if the Bible content for a specific version is cached
   * @param versionId - version ID
   * @returns true if cached, false otherwise
   */
  const hasCachedContent = async (versionId: number): Promise<boolean> => {
    return await bibleCacheDB.has(BibleCacheConfig.STORE_NAME, versionId)
  }

  /**
   * Add verse to history
   * If the verse already exists (same book, chapter, verse), removes the old record first
   * Maintains history limit of 50 items by removing the oldest when exceeded
   * @param verse - The verse to add to history
   */
  const addToHistory = (verse: MultiFunctionVerse) => {
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
      historyVerses.value.pop()
    }
  }

  /**
   * Remove a verse from history by ID
   * @param id - The verse ID to remove
   */
  const removeHistoryItem = (id: string) => {
    historyVerses.value = historyVerses.value.filter((item) => item.id !== id)
  }

  /**
   * Clear all history
   */
  const clearHistory = () => {
    historyVerses.value = []
  }

  return {
    // Bible Content Cache
    currentBibleContent,
    saveBibleContent,
    getBibleContent,
    hasCachedContent,
    clearCurrentBibleContent,
    // History Management
    historyVerses,
    addToHistory,
    removeHistoryItem,
    clearHistory,
  }
})
