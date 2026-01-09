import type { IndexedDBConfig } from '@/composables/useIndexedDB'
import { FolderDBStore } from '@/types/enum'

/**
 * Bible Database Configuration
 * Stores Bible versions and search index data
 */
export const BIBLE_DB_CONFIG: IndexedDBConfig = {
  dbName: FolderDBStore.BIBLE_DB_NAME,
  version: 2,
  stores: [
    {
      name: FolderDBStore.BIBLE_DB_CONTENT_STORE_NAME,
      keyPath: FolderDBStore.BIBLE_DB_STORE_KEY_PATH,
    },
    {
      name: FolderDBStore.BIBLE_DB_SEARCH_INDEX_STORE_NAME,
      keyPath: FolderDBStore.BIBLE_DB_STORE_KEY_PATH,
    },
  ],
}

/**
 * Folder Database Configuration
 * Stores folder structure and thumbnails data
 */
export const FOLDER_DB_CONFIG: IndexedDBConfig = {
  dbName: FolderDBStore.FOLDER_DB_NAME,
  version: 1,
  stores: [
    {
      name: FolderDBStore.FOLDER_DB_STRUCTURE_STORE_NAME,
      keyPath: FolderDBStore.FOLDER_DB_STORE_KEY_PATH,
    },
    {
      name: FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
      keyPath: FolderDBStore.FOLDER_DB_STORE_KEY_PATH,
    },
  ],
}
