import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BibleCacheItem, BibleContent } from '@/types/bible'
import { BibleCacheConfig } from '@/types/bible'
import { useIndexedDB } from '@/composables/useIndexedDB'

export const useBibleStore = defineStore('bible', () => {
  // 當前載入的 Bible Content（避免重複讀取 IndexedDB）
  const currentBibleContent = ref<{
    versionId: number
    content: BibleContent
  } | null>(null)

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

    // 更新 currentBibleContent 狀態
    currentBibleContent.value = {
      versionId,
      content,
    }
  }

  /**
   * Get Bible content from IndexedDB or cache
   * 如果 currentBibleContent 已有相同版本，直接返回，避免重複讀取 IndexedDB
   * @param versionId - version ID
   * @returns Bible content, if not exists, return null
   */
  const getBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    if (currentBibleContent.value && currentBibleContent.value.versionId === versionId) {
      return currentBibleContent.value.content
    }

    // 否則從 IndexedDB 讀取
    const cached = await bibleCacheDB.get<BibleCacheItem>(BibleCacheConfig.STORE_NAME, versionId)
    const content = cached?.content ?? null

    // 更新 currentBibleContent 狀態
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
   * 清除當前載入的 Bible Content 狀態（例如切換版本時）
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

  return {
    // Bible Content
    currentBibleContent,
    saveBibleContent,
    getBibleContent,
    hasCachedContent,
    clearCurrentBibleContent,
  }
})
