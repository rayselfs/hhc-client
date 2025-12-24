import { useSentry } from './useSentry'
import { useLocalStorage } from './useLocalStorage'
import { useElectron } from './useElectron'

/**
 * useFactoryReset composable
 * Handles factory reset functionality
 */
export function useFactoryReset() {
  const { reportError } = useSentry()
  const { clear } = useLocalStorage()
  const { isElectron, resetUserData } = useElectron()
  /**
   * Clear all IndexedDB databases
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
                // Continue execution even if blocked
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
   * Clear all storage (localStorage, sessionStorage, IndexedDB)
   */
  const clearAllStorage = async (): Promise<boolean> => {
    try {
      // Clear localStorage
      clear()

      // Clear sessionStorage
      sessionStorage.clear()

      // Clear IndexedDB
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
   * Perform factory reset
   * Clears all storage data and reloads page
   */
  const performFactoryReset = async () => {
    const success = await clearAllStorage()
    if (success) {
      if (isElectron()) {
        await resetUserData()
      }

      // Reload page to ensure all state is reset
      window.location.reload()
    }
    return success
  }

  return {
    clearAllStorage,
    performFactoryReset,
  }
}
