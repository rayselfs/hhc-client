import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'
import type { AnyItemRecord, FolderRecord } from '@shared/types/folder'

interface FileBlobRecord {
  id: string
  blob: Blob
}

interface FileExplorerDBSchema extends DBSchema {
  folders: {
    key: string
    value: FolderRecord
    indexes: { 'by-parent': string }
  }
  items: {
    key: string
    value: AnyItemRecord
    indexes: { 'by-parent': string }
  }
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
const DB_VERSION = 1

let fileExplorerDBPromise: Promise<IDBPDatabase<FileExplorerDBSchema>> | null = null

function getFileExplorerDB(): Promise<IDBPDatabase<FileExplorerDBSchema>> {
  if (!fileExplorerDBPromise) {
    fileExplorerDBPromise = openDB<FileExplorerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' })
          folderStore.createIndex('by-parent', 'parentId')
        }

        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' })
          itemStore.createIndex('by-parent', 'parentId')
        }

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
      }
    })
  }

  return fileExplorerDBPromise
}

export async function openFileExplorerDB(): Promise<IDBDatabase> {
  return (await getFileExplorerDB()) as unknown as IDBDatabase
}

export async function storeFileBlob(db: IDBDatabase, id: string, blob: Blob): Promise<void> {
  const idb = db as unknown as IDBPDatabase<FileExplorerDBSchema>
  await idb.put('file-blobs', { id, blob })
}

export async function getFileBlob(db: IDBDatabase, id: string): Promise<Blob | null> {
  const idb = db as unknown as IDBPDatabase<FileExplorerDBSchema>
  const record = await idb.get('file-blobs', id)
  return record?.blob ?? null
}

export async function deleteFileBlob(db: IDBDatabase, id: string): Promise<void> {
  const idb = db as unknown as IDBPDatabase<FileExplorerDBSchema>
  await idb.delete('file-blobs', id)
}
