import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB, unwrap } from 'idb'
import type { AnyItemRecord, FolderRecord } from '@shared/types/folder'

interface FileBlobRecord {
  id: string
  blob: Blob
}

interface FileExplorerDBSchema extends DBSchema {
  'file-blobs': {
    key: string
    value: FileBlobRecord
  }
  'folder-records': {
    key: string
    value: FolderRecord
    indexes: { 'by-parent': string }
  }
  'folder-items': {
    key: string
    value: AnyItemRecord
    indexes: { 'by-parent': string }
  }
}

const DB_NAME = 'hhc-file-explorer'
const DB_VERSION = 2

let fileExplorerDBPromise: Promise<IDBPDatabase<FileExplorerDBSchema>> | null = null

function getFileExplorerDB(): Promise<IDBPDatabase<FileExplorerDBSchema>> {
  if (!fileExplorerDBPromise) {
    fileExplorerDBPromise = openDB<FileExplorerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('file-blobs')) {
          db.createObjectStore('file-blobs', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('folder-records')) {
          const folderRecordStore = db.createObjectStore('folder-records', { keyPath: 'id' })
          folderRecordStore.createIndex('by-parent', 'parentId')
        }

        if (!db.objectStoreNames.contains('folder-items')) {
          const folderItemStore = db.createObjectStore('folder-items', { keyPath: 'id' })
          folderItemStore.createIndex('by-parent', 'parentId')
        }

        if (oldVersion < 2) {
          const nativeDb: IDBDatabase = unwrap(db)
          if (nativeDb.objectStoreNames.contains('folders')) nativeDb.deleteObjectStore('folders')
          if (nativeDb.objectStoreNames.contains('items')) nativeDb.deleteObjectStore('items')
        }
      }
    })
  }

  return fileExplorerDBPromise
}

export async function openFileExplorerDB(): Promise<IDBPDatabase<FileExplorerDBSchema>> {
  return getFileExplorerDB()
}

export async function storeFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string,
  blob: Blob
): Promise<void> {
  await db.put('file-blobs', { id, blob })
}

export async function getFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<Blob | null> {
  const record = await db.get('file-blobs', id)
  return record?.blob ?? null
}

export async function deleteFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<void> {
  await db.delete('file-blobs', id)
}
