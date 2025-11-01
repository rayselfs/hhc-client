import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { useSentry } from './useSentry'

/**
 * IndexedDB 配置
 */
export interface IndexedDBConfig {
  dbName: string
  version: number
  stores: StoreConfig[]
}

/**
 * Object Store 配置
 */
export interface StoreConfig {
  name: string
  keyPath?: string
  autoIncrement?: boolean
  indices?: IndexConfig[]
}

/**
 * Index 配置
 */
export interface IndexConfig {
  name: string
  keyPath: string | string[]
  unique?: boolean
}

/**
 * 通用 IndexedDB Schema - 使用 Record 類型以支持動態 store 名稱
 */
type GenericDB = DBSchema & Record<string, { key: unknown; value: unknown }>

/**
 * useIndexedDB composable
 * 提供通用的 IndexedDB 操作功能
 */
export function useIndexedDB(config: IndexedDBConfig) {
  const { reportError } = useSentry()
  let dbInstance: IDBPDatabase<GenericDB> | null = null

  /**
   * 初始化 IndexedDB
   */
  const initDB = async (): Promise<IDBPDatabase<GenericDB>> => {
    if (dbInstance) {
      return dbInstance
    }

    try {
      // 使用類型斷言以支持動態 store 名稱
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dbInstance = (await (openDB as any)(config.dbName, config.version, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upgrade(db: any) {
          // 為每個 store 創建 object store
          config.stores.forEach((storeConfig) => {
            if (!db.objectStoreNames.contains(storeConfig.name)) {
              const objectStore = storeConfig.autoIncrement
                ? db.createObjectStore(storeConfig.name, {
                    autoIncrement: storeConfig.autoIncrement,
                  })
                : db.createObjectStore(storeConfig.name, {
                    keyPath: storeConfig.keyPath,
                  })

              // 創建索引
              if (storeConfig.indices) {
                storeConfig.indices.forEach((indexConfig) => {
                  if (!objectStore.indexNames.contains(indexConfig.name)) {
                    objectStore.createIndex(indexConfig.name, indexConfig.keyPath, {
                      unique: indexConfig.unique,
                    })
                  }
                })
              }
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
   * 獲取指定 store 的值
   * @param storeName - Object store 名稱
   * @param key - 主鍵
   * @returns 值，如果不存在則返回 undefined
   */
  const get = async <T = unknown>(storeName: string, key: unknown): Promise<T | undefined> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 保存值到指定 store
   * @param storeName - Object store 名稱
   * @param value - 要保存的值
   * @returns 保存的 key
   */
  const put = async <T = unknown>(storeName: string, value: T): Promise<unknown> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (db as any).put(storeName, value)
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
   * 添加值到指定 store（如果 key 已存在則失敗）
   * @param storeName - Object store 名稱
   * @param value - 要添加的值
   * @returns 添加的 key
   */
  const add = async <T = unknown>(storeName: string, value: T): Promise<unknown> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (db as any).add(storeName, value)
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
   * 從指定 store 刪除值
   * @param storeName - Object store 名稱
   * @param key - 主鍵
   */
  const deleteItem = async (storeName: string, key: unknown): Promise<void> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 獲取指定 store 的所有值
   * @param storeName - Object store 名稱
   * @returns 所有值
   */
  const getAll = async <T = unknown>(storeName: string): Promise<T[]> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 獲取指定 store 的所有主鍵
   * @param storeName - Object store 名稱
   * @returns 所有主鍵
   */
  const getAllKeys = async <T = unknown>(storeName: string): Promise<T[]> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 清空指定 store 的所有數據
   * @param storeName - Object store 名稱
   */
  const clear = async (storeName: string): Promise<void> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 檢查指定 store 中是否存在指定的 key
   * @param storeName - Object store 名稱
   * @param key - 主鍵
   * @returns 是否存在
   */
  const has = async (storeName: string, key: unknown): Promise<boolean> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 使用索引查詢
   * @param storeName - Object store 名稱
   * @param indexName - 索引名稱
   * @param query - 查詢值或範圍
   * @returns 匹配的值
   */
  const getByIndex = async <T = unknown>(
    storeName: string,
    indexName: string,
    query: IDBKeyRange | unknown,
  ): Promise<T[]> => {
    try {
      const db = await initDB()
      // 使用類型斷言來繞過 TypeScript 的嚴格檢查，因為 store 名稱是動態的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * 關閉數據庫連接
   */
  const close = async (): Promise<void> => {
    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
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
  }
}
