import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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
 * Generic IndexedDB Schema - Uses Record type to support dynamic store names
 */
type GenericDB = DBSchema & Record<string, { key: unknown; value: unknown }>

/**
 * useIndexedDB composable
 * Provides generic IndexedDB operation capabilities
 */
export function useIndexedDB(config: IndexedDBConfig) {
  const { reportError } = useSentry()
  let dbInstance: IDBPDatabase<GenericDB> | null = null

  /**
   * Initialize IndexedDB
   */
  const initDB = async (): Promise<IDBPDatabase<GenericDB>> => {
    if (dbInstance) {
      return dbInstance
    }

    try {
      // Use type assertion to support dynamic store names

      dbInstance = (await (openDB as any)(config.dbName, config.version, {
        upgrade(db: any) {
          // Create object store for each store
          config.stores.forEach((storeConfig) => {
            // If store exists and we are upgrading, we might need to recreate it
            // if the structure (like keyPath) changed.
            // For now, only recreate if explicitly needed or if it doesn't exist.
            if (db.objectStoreNames.contains(storeConfig.name)) {
              return // Skip existing stores
            }

            const objectStore = storeConfig.autoIncrement
              ? db.createObjectStore(storeConfig.name, {
                  autoIncrement: storeConfig.autoIncrement,
                })
              : db.createObjectStore(storeConfig.name, {
                  keyPath: storeConfig.keyPath,
                })

            // Create indices
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
      })) as IDBPDatabase<GenericDB>
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
  const get = async <T = unknown>(storeName: string, key: unknown): Promise<T | undefined> => {
    try {
      const db = await initDB()
      // Use type assertion to bypass TypeScript strict check because store name is dynamic

      return (await (db as any).get(storeName, key)) as T | undefined
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
  ): Promise<unknown> => {
    try {
      const db = await initDB()

      return await (db as any).put(storeName, value, key)
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
  ): Promise<unknown> => {
    try {
      const db = await initDB()

      return await (db as any).add(storeName, value, key)
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
  const deleteItem = async (storeName: string, key: unknown): Promise<void> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的

      await (db as any).delete(storeName, key)
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
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的

      return (await (db as any).getAll(storeName)) as T[]
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
  const getAllKeys = async <T = unknown>(storeName: string): Promise<T[]> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的

      return (await (db as any).getAllKeys(storeName)) as T[]
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
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的

      await (db as any).clear(storeName)
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
  const has = async (storeName: string, key: unknown): Promise<boolean> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的

      const result = await (db as any).get(storeName, key)
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
    query: IDBKeyRange | unknown,
  ): Promise<T[]> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的

      const tx = (db as any).transaction(storeName, 'readonly')
      const index = tx.store.index(indexName)
      return (await index.getAll(query)) as T[]
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

      const tx = (db as any).transaction(storeName, 'readwrite')
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
  const deleteBatch = async (storeName: string, keys: unknown[]): Promise<void> => {
    if (keys.length === 0) return

    try {
      const db = await initDB()

      const tx = (db as any).transaction(storeName, 'readwrite')
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
    callback: (stores: Record<string, IDBObjectStore>) => Promise<T>,
  ): Promise<T> => {
    try {
      const db = await initDB()

      const tx = (db as any).transaction(storeNames, mode)

      const stores: Record<string, IDBObjectStore> = {}
      for (const name of storeNames) {
        stores[name] = tx.objectStore(name)
      }

      const result = await callback(stores)
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
