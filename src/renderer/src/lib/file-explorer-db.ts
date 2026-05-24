import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB, unwrap } from 'idb'
import type { AnyItemRecord, FolderRecord } from '@shared/types/folder'
import { isElectron } from './env'

interface FileBlobRecord {
  id: string
  blob?: Blob
  storage?: 'indexed-db' | 'native-fs'
  size?: number
  refCount?: number
}

export interface FileExplorerDBSchema extends DBSchema {
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
const DB_VERSION = 3
export const NATIVE_FS_THRESHOLD = 100 * 1024 * 1024

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
  if (isElectron() && blob.size > NATIVE_FS_THRESHOLD) {
    await window.api.nativeFs.store(id, await blob.arrayBuffer())
    await db.put('file-blobs', { id, storage: 'native-fs', size: blob.size, refCount: 1 })
    return
  }

  await db.put('file-blobs', { id, blob, refCount: 1 })
}

export async function getFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<Blob | null> {
  const record = await db.get('file-blobs', id)
  if (record?.storage === 'native-fs') {
    const buffer = await window.api.nativeFs.read(id)
    return new Blob([buffer])
  }

  return record?.blob ?? null
}

export async function deleteFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<void> {
  const record = await db.get('file-blobs', id)
  if (!record) return

  if (record.refCount === undefined || record.refCount <= 1) {
    if (record.storage === 'native-fs' && isElectron()) {
      await window.api.nativeFs.delete(id)
    }
    await db.delete('file-blobs', id)
    return
  }

  await db.put('file-blobs', { ...record, refCount: record.refCount - 1 })
}

export async function incrementBlobRef(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<void> {
  const record = await db.get('file-blobs', id)
  if (!record) throw new Error(`File blob not found: ${id}`)

  await db.put('file-blobs', { ...record, refCount: (record.refCount ?? 1) + 1 })
}
