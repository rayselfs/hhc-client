import type { IndexedDBConfig } from '@/composables/useIndexedDB'

/**
 * Bible Database Configuration
 * Stores Bible versions and search index data
 */
export const BIBLE_DB_CONFIG: IndexedDBConfig = {
  dbName: 'BibleDB',
  version: 2,
  stores: [
    {
      name: 'bibleContent',
      keyPath: 'version_code',
    },
    {
      name: 'bibleSearchIndex',
      keyPath: 'version_code',
    },
  ],
}

/**
 * Media Library Database Configuration
 * Stores folder structure and thumbnail blobs
 */
export const MEDIA_DB_CONFIG: IndexedDBConfig = {
  dbName: 'MediaDB',
  version: 1,
  stores: [
    {
      name: 'folder-structure',
      keyPath: 'id', // Rebuild index will use this to restore the tree
    },
    {
      name: 'thumbnails',
      keyPath: 'id',
    },
  ],
}
