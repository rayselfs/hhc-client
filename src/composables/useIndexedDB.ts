import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb'
import { useSentry } from './useSentry'

/**
 * IndexedDB Configuration
 */
export interface IndexedDBConfig {
  dbName: string
  version: number
  stores: StoreConfig[]
}

/**
 * Object Store Configuration
 */
export interface StoreConfig {
  name: string
  keyPath?: string
  autoIncrement?: boolean
  indices?: IndexConfig[]
}

/**
 * Index Configuration
 */
export interface IndexConfig {
  name: string
  keyPath: string | string[]
  unique?: boolean
}

/**
 * Type assertion helper for dynamic store names
 * The idb library's type system doesn't support truly dynamic store names,
 * so we use type assertions while maintaining runtime safety
 */
type DynamicDB = IDBPDatabase

/**
 * useIndexedDB composable
 * Provides generic IndexedDB operation capabilities
 */
export function useIndexedDB(config: IndexedDBConfig) {
  const { reportError } = useSentry()
  let dbInstance: DynamicDB | null = null

  /**
   * Initialize IndexedDB
   */
  const initDB = async (): Promise<DynamicDB> => {
    if (dbInstance) {
      return dbInstance
    }

    try {
      dbInstance = await openDB(config.dbName, config.version, {
        upgrade(db) {
          config.stores.forEach((storeConfig) => {
            if (db.objectStoreNames.contains(storeConfig.name)) {
              return
            }

            const objectStore = storeConfig.autoIncrement
              ? db.createObjectStore(storeConfig.name, {
                  autoIncrement: storeConfig.autoIncrement,
                })
              : db.createObjectStore(storeConfig.name, {
                  keyPath: storeConfig.keyPath,
                })

            if (storeConfig.indices) {
              storeConfig.indices.forEach((indexConfig) => {
                if (!objectStore.indexNames.contains(indexConfig.name)) {
                  objectStore.createIndex(indexConfig.name, indexConfig.keyPath, {
                    unique: indexConfig.unique,
                  })
                }
              })
            }
          })
        },
      })
      return dbInstance
    } catch (error) {
      reportError(error, {
        operation: 'init-indexeddb',
        component: 'useIndexedDB',
        extra: { dbName: config.dbName },
      })
      throw error
    }
  }

  /**
   * Get value from specified store
   * @param storeName - Object store name
   * @param key - Primary key
   * @returns Value, or undefined if not exists
   */
  const get = async <T = unknown>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    try {
      const db = await initDB()
      return (await db.get(storeName, key)) as T | undefined
    } catch (error) {
      reportError(error, {
        operation: 'get-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName, key },
      })
      return undefined
    }
  }

  /**
   * Save value to specified store
   * @param storeName - Object store name
   * @param value - Value to save
   * @returns Saved key
   */
  const put = async <T = unknown>(
    storeName: string,
    value: T,
    key?: IDBValidKey,
  ): Promise<IDBValidKey> => {
    try {
      const db = await initDB()
      return await db.put(storeName, value, key)
    } catch (error) {
      reportError(error, {
        operation: 'put-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName },
      })
      throw error
    }
  }

  /**
   * Add value to specified store (fails if key exists)
   * @param storeName - Object store name
   * @param value - Value to add
   * @returns Added key
   */
  const add = async <T = unknown>(
    storeName: string,
    value: T,
    key?: IDBValidKey,
  ): Promise<IDBValidKey> => {
    try {
      const db = await initDB()
      return await db.add(storeName, value, key)
    } catch (error) {
      reportError(error, {
        operation: 'add-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName },
      })
      throw error
    }
  }

  /**
   * Delete value from specified store
   * @param storeName - Object store name
   * @param key - Primary key
   */
  const deleteItem = async (storeName: string, key: IDBValidKey): Promise<void> => {
    try {
      const db = await initDB()
      await db.delete(storeName, key)
    } catch (error) {
      reportError(error, {
        operation: 'delete-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName, key },
      })
      throw error
    }
  }

  /**
   * Get all values from specified store
   * @param storeName - Object store name
   * @returns All values
   */
  const getAll = async <T = unknown>(storeName: string): Promise<T[]> => {
    try {
      const db = await initDB()
      return (await db.getAll(storeName)) as T[]
    } catch (error) {
      reportError(error, {
        operation: 'getall-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName },
      })
      return []
    }
  }

  /**
   * Get all keys from specified store
   * @param storeName - Object store name
   * @returns All keys
   */
  const getAllKeys = async <T = IDBValidKey>(storeName: string): Promise<T[]> => {
    try {
      const db = await initDB()
      return (await db.getAllKeys(storeName)) as T[]
    } catch (error) {
      reportError(error, {
        operation: 'getallkeys-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName },
      })
      return []
    }
  }

  /**
   * Clear all data from specified store
   * @param storeName - Object store name
   */
  const clear = async (storeName: string): Promise<void> => {
    try {
      const db = await initDB()
      await db.clear(storeName)
    } catch (error) {
      reportError(error, {
        operation: 'clear-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName },
      })
      throw error
    }
  }

  /**
   * Check if specified key exists in specified store
   * @param storeName - Object store name
   * @param key - Primary key
   * @returns Whether it exists
   */
  const has = async (storeName: string, key: IDBValidKey): Promise<boolean> => {
    try {
      const db = await initDB()
      const result = await db.get(storeName, key)
      return result !== undefined
    } catch (error) {
      reportError(error, {
        operation: 'has-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName, key },
      })
      return false
    }
  }

  /**
   * Query using index
   * @param storeName - Object store name
   * @param indexName - Index name
   * @param query - Query value or range
   * @returns Matched values
   */
  const getByIndex = async <T = unknown>(
    storeName: string,
    indexName: string,
    query: IDBKeyRange | IDBValidKey,
  ): Promise<T[]> => {
    try {
      const db = await initDB()
      const tx = db.transaction(storeName, 'readonly')
      const index = tx.store.index(indexName)
      return (await index.getAll(query as IDBKeyRange)) as T[]
    } catch (error) {
      reportError(error, {
        operation: 'getbyindex-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName, indexName },
      })
      return []
    }
  }

  /**
   * Close database connection
   */
  const close = async (): Promise<void> => {
    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
    }
  }

  /**
   * Batch put multiple items into a store
   * @param storeName - Object store name
   * @param items - Array of items to put
   */
  const putBatch = async <T = unknown>(storeName: string, items: T[]): Promise<void> => {
    if (items.length === 0) return

    try {
      const db = await initDB()
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)

      for (const item of items) {
        store.put(item)
      }

      await tx.done
    } catch (error) {
      reportError(error, {
        operation: 'putbatch-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName, count: items.length },
      })
      throw error
    }
  }

  /**
   * Batch delete multiple items from a store
   * @param storeName - Object store name
   * @param keys - Array of keys to delete
   */
  const deleteBatch = async (storeName: string, keys: IDBValidKey[]): Promise<void> => {
    if (keys.length === 0) return

    try {
      const db = await initDB()
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)

      for (const key of keys) {
        store.delete(key)
      }

      await tx.done
    } catch (error) {
      reportError(error, {
        operation: 'deletebatch-indexeddb',
        component: 'useIndexedDB',
        extra: { storeName, count: keys.length },
      })
      throw error
    }
  }

  /**
   * Execute a transaction across multiple stores
   * @param storeNames - Array of store names to include in transaction
   * @param mode - Transaction mode ('readonly' or 'readwrite')
   * @param callback - Function to execute within transaction
   */
  const transaction = async <T = void>(
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: (tx: IDBPTransaction<unknown, string[], IDBTransactionMode>) => Promise<T>,
  ): Promise<T> => {
    try {
      const db = await initDB()
      const tx = db.transaction(storeNames, mode)
      const result = await callback(tx as IDBPTransaction<unknown, string[], IDBTransactionMode>)
      await tx.done
      return result
    } catch (error) {
      reportError(error, {
        operation: 'transaction-indexeddb',
        component: 'useIndexedDB',
        extra: { storeNames, mode },
      })
      throw error
    }
  }

  return {
    initDB,
    get,
    put,
    add,
    delete: deleteItem,
    getAll,
    getAllKeys,
    clear,
    has,
    getByIndex,
    close,
    putBatch,
    deleteBatch,
    transaction,
  }
}
