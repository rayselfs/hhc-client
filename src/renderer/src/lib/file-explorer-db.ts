import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB, unwrap } from 'idb'
import type { AnyItemRecord, FolderRecord } from '@shared/types/folder'
import { isElectron } from './env'
import { getDerivedAsset } from './media-work-db'

export interface FileBlobRecord {
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
    indexes: { 'by-parent': string; 'by-deleted-at': number }
  }
}

const DB_NAME = 'hhc-file-explorer'
const DB_VERSION = 4
const TRANSCODE_COMPATIBILITY_VARIANT = 'mp4-h264-aac-yuv420p-faststart'

let fileExplorerDBPromise: Promise<IDBPDatabase<FileExplorerDBSchema>> | null = null

function getFileExplorerDB(): Promise<IDBPDatabase<FileExplorerDBSchema>> {
  if (!fileExplorerDBPromise) {
    fileExplorerDBPromise = openDB<FileExplorerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
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

        if (oldVersion < 4) {
          const itemStore = tx.objectStore('folder-items')
          if (!itemStore.indexNames.contains('by-deleted-at')) {
            itemStore.createIndex('by-deleted-at', 'deletedAt')
          }
        }
      }
    })
  }

  return fileExplorerDBPromise
}

export async function openFileExplorerDB(): Promise<IDBPDatabase<FileExplorerDBSchema>> {
  return getFileExplorerDB()
}

export async function listFileBlobRecords(): Promise<FileBlobRecord[]> {
  return (await getFileExplorerDB()).getAll('file-blobs')
}

export async function getFileBlobRecord(id: string): Promise<FileBlobRecord | undefined> {
  return (await getFileExplorerDB()).get('file-blobs', id)
}

export async function storeFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string,
  file: File
): Promise<void> {
  if (isElectron()) {
    const imported = await window.api.nativeFs.importFile(id, file)
    try {
      await db.put('file-blobs', {
        id,
        storage: 'native-fs',
        size: imported.size,
        refCount: 1
      })
    } catch (error) {
      await window.api.nativeFs.delete(id).catch(() => undefined)
      throw error
    }
    return
  }

  await db.put('file-blobs', { id, blob: file, refCount: 1 })
}

export async function getFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<Blob | null> {
  const record = await db.get('file-blobs', id)
  return record?.blob ?? null
}

export interface FileSource {
  url: string
  revoke: () => void
}

export async function getFileSource(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string,
  mimeType: string
): Promise<FileSource | null> {
  if (mimeType.startsWith('video/')) {
    const transcoded = await getDerivedAsset(
      id,
      'transcoded-video',
      TRANSCODE_COMPATIBILITY_VARIANT
    )
    if (transcoded?.storage === 'native-fs' && transcoded.nativeFileId && isElectron()) {
      return {
        url: window.api.nativeFs.getUrl(transcoded.nativeFileId, transcoded.mimeType),
        revoke: () => undefined
      }
    }
  }

  const record = await db.get('file-blobs', id)
  if (!record) return null

  if (record.storage === 'native-fs') {
    if (!isElectron()) return null
    return {
      url: window.api.nativeFs.getUrl(id, mimeType),
      revoke: () => undefined
    }
  }

  if (!record.blob) return null
  const url = URL.createObjectURL(record.blob)
  return {
    url,
    revoke: () => URL.revokeObjectURL(url)
  }
}

export async function deleteFileBlob(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<boolean> {
  const record = await db.get('file-blobs', id)
  if (!record) return false

  if (record.refCount === undefined || record.refCount <= 1) {
    if (record.storage === 'native-fs' && isElectron()) {
      await window.api.nativeFs.delete(id)
    }
    await db.delete('file-blobs', id)
    return true
  }

  await db.put('file-blobs', { ...record, refCount: record.refCount - 1 })
  return false
}

export async function incrementBlobRef(
  db: IDBPDatabase<FileExplorerDBSchema>,
  id: string
): Promise<void> {
  const record = await db.get('file-blobs', id)
  if (!record) throw new Error(`File blob not found: ${id}`)

  await db.put('file-blobs', { ...record, refCount: (record.refCount ?? 1) + 1 })
}

export async function resetFileExplorerDBForTests(): Promise<void> {
  const db = await fileExplorerDBPromise
  db?.close()
  fileExplorerDBPromise = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('File explorer database deletion blocked'))
  })
}
