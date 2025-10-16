import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { useSentry } from './useSentry'
import type { BibleContent, BibleBook } from '@/types/bible'

/**
 * IndexedDB Schema for Bible Cache
 */
interface BibleCacheDB extends DBSchema {
  bibleContent: {
    key: number // version_id
    value: {
      versionId: number
      versionCode: string
      versionName: string
      content: BibleContent // 完整的聖經內容
      timestamp: number // 快取時間
    }
  }
}

const DB_NAME = 'BibleCache'
const DB_VERSION = 1
const STORE_NAME = 'bibleContent'

/**
 * 初始化 IndexedDB
 */
async function initDB(): Promise<IDBPDatabase<BibleCacheDB>> {
  return openDB<BibleCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 創建 object store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'versionId' })
      }
    },
  })
}

/**
 * useBibleCache composable
 * 使用 IndexedDB 來儲存和管理聖經內容快取
 */
export function useBibleCache() {
  const { reportError } = useSentry()
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
    try {
      const db = await initDB()
      await db.put(STORE_NAME, {
        versionId,
        versionCode,
        versionName,
        content,
        timestamp: Date.now(),
      })
    } catch (error) {
      reportError(error, {
        operation: 'save-bible-content-cache',
        component: 'useBibleCache',
        extra: { versionId },
      })
      throw error
    }
  }

  /**
   * 逐步儲存聖經書籍到 IndexedDB（用於 streaming）
   * @param versionId - 版本 ID
   * @param versionCode - 版本代碼
   * @param versionName - 版本名稱
   * @param book - 聖經書籍
   */
  const saveBibleBook = async (
    versionId: number,
    versionCode: string,
    versionName: string,
    book: BibleBook,
  ): Promise<void> => {
    try {
      const db = await initDB()

      // 檢查是否已有該版本的快取
      let cached = await db.get(STORE_NAME, versionId)

      if (!cached) {
        // 創建新的快取項目
        cached = {
          versionId,
          versionCode,
          versionName,
          content: {
            version_id: versionId,
            version_code: versionCode,
            version_name: versionName,
            books: [],
          },
          timestamp: Date.now(),
        }
      }

      // 添加書籍到內容中
      cached.content.books.push(book)
      cached.timestamp = Date.now()

      // 更新快取
      await db.put(STORE_NAME, cached)
    } catch (error) {
      reportError(error, {
        operation: 'save-bible-book-cache',
        component: 'useBibleCache',
        extra: { versionId, book },
      })
      throw error
    }
  }

  /**
   * 從 IndexedDB 讀取聖經內容
   * @param versionId - 版本 ID
   * @returns 聖經內容，如果不存在則返回 null
   */
  const getBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    try {
      const db = await initDB()
      const cached = await db.get(STORE_NAME, versionId)

      if (cached) {
        return cached.content
      }

      return null
    } catch (error) {
      reportError(error, {
        operation: 'read-bible-content-cache',
        component: 'useBibleCache',
        extra: { versionId },
      })
      return null
    }
  }

  /**
   * 檢查特定版本的聖經內容是否已快取
   * @param versionId - 版本 ID
   * @returns 是否已快取
   */
  const hasCachedContent = async (versionId: number): Promise<boolean> => {
    try {
      const db = await initDB()
      const cached = await db.get(STORE_NAME, versionId)
      return cached !== undefined
    } catch (error) {
      reportError(error, {
        operation: 'check-cache',
        component: 'useBibleCache',
        extra: { versionId },
      })
      return false
    }
  }

  /**
   * 刪除特定版本的快取
   * @param versionId - 版本 ID
   */
  const deleteCachedContent = async (versionId: number): Promise<void> => {
    try {
      const db = await initDB()
      await db.delete(STORE_NAME, versionId)
    } catch (error) {
      reportError(error, {
        operation: 'delete-cache',
        component: 'useBibleCache',
        extra: { versionId },
      })
      throw error
    }
  }

  /**
   * 清空所有快取
   */
  const clearAllCache = async (): Promise<void> => {
    try {
      const db = await initDB()
      await db.clear(STORE_NAME)
    } catch (error) {
      reportError(error, {
        operation: 'clear-all-cache',
        component: 'useBibleCache',
      })
      throw error
    }
  }

  /**
   * 取得所有已快取的版本 ID
   */
  const getAllCachedVersionIds = async (): Promise<number[]> => {
    try {
      const db = await initDB()
      const keys = await db.getAllKeys(STORE_NAME)
      return keys
    } catch (error) {
      reportError(error, {
        operation: 'get-cached-version-ids',
        component: 'useBibleCache',
      })
      return []
    }
  }

  return {
    saveBibleContent,
    saveBibleBook,
    getBibleContent,
    hasCachedContent,
    deleteCachedContent,
    clearAllCache,
    getAllCachedVersionIds,
  }
}
