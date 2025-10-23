import { useSentry } from './useSentry'

/**
 * useFactoryReset composable
 * 處理恢復原廠設定功能
 */
export function useFactoryReset() {
  const { reportError } = useSentry()

  /**
   * 清除所有 IndexedDB 資料庫
   */
  const clearAllIndexedDB = async (): Promise<boolean> => {
    try {
      if (window.indexedDB) {
        const databases = await window.indexedDB.databases()
        const deletePromises = databases.map((db) => {
          if (db.name) {
            return new Promise<void>((resolve, reject) => {
              const request = window.indexedDB.deleteDatabase(db.name!)
              request.onsuccess = () => resolve()
              request.onerror = () => reject(request.error)
              request.onblocked = () => {
                // 繼續執行，即使被阻擋
                resolve()
              }
            })
          }
          return Promise.resolve()
        })
        await Promise.all(deletePromises)
      }
      return true
    } catch (error) {
      reportError(error, {
        operation: 'clear-indexeddb',
        component: 'useFactoryReset',
      })
      return false
    }
  }

  /**
   * 清除所有儲存資料（localStorage、sessionStorage、IndexedDB）
   */
  const clearAllStorage = async (): Promise<boolean> => {
    try {
      // 清除 localStorage
      localStorage.clear()

      // 清除 sessionStorage
      sessionStorage.clear()

      // 清除 IndexedDB
      await clearAllIndexedDB()

      return true
    } catch (error) {
      reportError(error, {
        operation: 'clear-all-storage',
        component: 'useFactoryReset',
      })
      return false
    }
  }

  /**
   * 執行恢復原廠設定
   * 清除所有儲存資料並重新載入頁面
   */
  const performFactoryReset = async () => {
    const success = await clearAllStorage()
    if (success) {
      // 重新載入頁面以確保所有狀態被重置
      window.location.reload()
    }
    return success
  }

  return {
    clearAllStorage,
    performFactoryReset,
  }
}
