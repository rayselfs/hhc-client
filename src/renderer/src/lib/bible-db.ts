import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'
import type { FolderRecord, AnyItemRecord } from '@shared/types/folder'

interface BibleBookDB {
  number: number
  code: string
  name: string
  abbreviation: string
  chapters: {
    number: number
    verses: { id: number; number: number; text: string }[]
  }[]
}

interface BibleVersionDB {
  id: number
  code: string
  name: string
  updatedAt: number
}

interface LegacyFolderDB {
  id: string
  name: string
  parentId: string | null
  items: Record<string, unknown>[]
  folders: LegacyFolderDB[]
  createdAt: number
  sortIndex?: number
  expiresAt?: number | null
}

interface FlexSearchCacheDB {
  chunks: { key: string; data: string }[]
  updatedAt: number
}

interface BibleDBSchema extends DBSchema {
  content: {
    key: number
    value: BibleBookDB[]
  }
  versions: {
    key: number
    value: BibleVersionDB
  }
  folders: {
    key: string
    value: LegacyFolderDB[]
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
  flexsearch: {
    key: number
    value: FlexSearchCacheDB
  }
}

const DB_VERSION = 3

let bibleDBPromise: Promise<IDBPDatabase<BibleDBSchema>> | null = null

function getBibleDB(): Promise<IDBPDatabase<BibleDBSchema>> {
  if (!bibleDBPromise) {
    bibleDBPromise = openDB<BibleDBSchema>('hhc-bible', DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('content')) db.createObjectStore('content')
          if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions')
          if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders')
          if (!db.objectStoreNames.contains('flexsearch')) db.createObjectStore('flexsearch')
        }

        if (oldVersion < 2) {
          const folderStore = db.createObjectStore('folder-records', { keyPath: 'id' })
          folderStore.createIndex('by-parent', 'parentId')

          const itemStore = db.createObjectStore('folder-items', { keyPath: 'id' })
          itemStore.createIndex('by-parent', 'parentId')

          if (db.objectStoreNames.contains('folders')) {
            const legacyStore = transaction.objectStore('folders')
            const fStore = transaction.objectStore('folder-records')
            const iStore = transaction.objectStore('folder-items')
            legacyStore.getAll().then((allTrees) => {
              for (const tree of allTrees) {
                if (!Array.isArray(tree) || tree.length === 0) continue
                const root = tree[0] as LegacyFolderDB
                migrateLegacyTree(root, fStore, iStore)
              }
              if (db.objectStoreNames.contains('folders')) {
                db.deleteObjectStore('folders')
              }
            })
          }
        }

        if (oldVersion < 3) {
          const iStore = transaction.objectStore('folder-items')
          iStore.getAll().then((items) => {
            for (const item of items) {
              const raw = item as unknown as Record<string, unknown>
              if (raw.type !== 'verse') continue
              const migrated = { ...raw }
              if ('verseStart' in migrated) {
                migrated.verse = migrated.verseStart
                delete migrated.verseStart
                delete migrated.verseEnd
              }
              if (!('versionId' in migrated)) {
                migrated.versionId = 0
              }
              delete migrated.bookCode
              delete migrated.bookName
              delete migrated.versionCode
              delete migrated.versionName
              iStore.put(migrated as unknown as AnyItemRecord)
            }
          })
        }
      }
    })
  }
  return bibleDBPromise
}

function migrateLegacyTree(
  node: LegacyFolderDB,
  folderStore: { put: (value: FolderRecord) => unknown },
  itemStore: { put: (value: AnyItemRecord) => unknown }
): void {
  const folderRecord: FolderRecord = {
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    sortIndex: node.sortIndex ?? 0,
    createdAt: node.createdAt,
    expiresAt: node.expiresAt ?? null
  }
  folderStore.put(folderRecord)

  for (let i = 0; i < node.items.length; i++) {
    const item = node.items[i] as Record<string, unknown>
    const itemRecord: AnyItemRecord = {
      ...item,
      parentId: node.id,
      sortIndex: (item.sortIndex as number) ?? i,
      createdAt: (item.createdAt as number) ?? node.createdAt,
      expiresAt: (item.expiresAt as number | null) ?? null
    } as AnyItemRecord
    itemStore.put(itemRecord)
  }

  for (const child of node.folders) {
    migrateLegacyTree(child, folderStore, itemStore)
  }
}

export async function openBibleDB(): Promise<IDBPDatabase<BibleDBSchema>> {
  return getBibleDB()
}

// ===== Bible Content =====

export async function saveBibleContent(versionId: number, content: BibleBookDB[]): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('content', content, versionId)
  } catch (error) {
    console.error('[bible-db] Failed to save content:', error)
  }
}

export async function loadBibleContent(versionId: number): Promise<BibleBookDB[] | undefined> {
  try {
    const db = await openBibleDB()
    return await db.get('content', versionId)
  } catch (error) {
    console.error('[bible-db] Failed to load content:', error)
    return undefined
  }
}

export async function saveBibleVersionMeta(versions: BibleVersionDB[]): Promise<void> {
  try {
    const db = await openBibleDB()
    await Promise.all(versions.map((v) => db.put('versions', v, v.id)))
  } catch (error) {
    console.error('[bible-db] Failed to save version metadata:', error)
  }
}

export async function loadBibleVersionMeta(): Promise<BibleVersionDB[] | undefined> {
  try {
    const db = await openBibleDB()
    const all = await db.getAll('versions')
    return all.length > 0 ? all : undefined
  } catch (error) {
    console.error('[bible-db] Failed to load version metadata:', error)
    return undefined
  }
}

export async function clearBibleContent(versionId?: number): Promise<void> {
  try {
    const db = await openBibleDB()
    if (versionId) {
      await db.delete('content', versionId)
    } else {
      await db.clear('content')
    }
  } catch (error) {
    console.error('[bible-db] Failed to clear content:', error)
  }
}

// ===== Folder Records =====

export async function loadAllFolders(): Promise<FolderRecord[]> {
  try {
    const db = await openBibleDB()
    return await db.getAll('folder-records')
  } catch (error) {
    console.error('[bible-db] Failed to load folders:', error)
    return []
  }
}

export async function saveFolder(folder: FolderRecord): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('folder-records', folder)
  } catch (error) {
    console.error('[bible-db] Failed to save folder:', error)
  }
}

export async function saveFolders(folders: FolderRecord[]): Promise<void> {
  try {
    const db = await openBibleDB()
    const tx = db.transaction('folder-records', 'readwrite')
    await Promise.all([...folders.map((f) => tx.store.put(f)), tx.done])
  } catch (error) {
    console.error('[bible-db] Failed to save folders:', error)
  }
}

export async function deleteFolder(id: string): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.delete('folder-records', id)
  } catch (error) {
    console.error('[bible-db] Failed to delete folder:', error)
  }
}

export async function deleteFolders(ids: string[]): Promise<void> {
  try {
    const db = await openBibleDB()
    const tx = db.transaction('folder-records', 'readwrite')
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
  } catch (error) {
    console.error('[bible-db] Failed to delete folders:', error)
  }
}

// ===== Folder Items =====

export async function loadItemsByParent(parentId: string): Promise<AnyItemRecord[]> {
  try {
    const db = await openBibleDB()
    return await db.getAllFromIndex('folder-items', 'by-parent', parentId)
  } catch (error) {
    console.error('[bible-db] Failed to load items:', error)
    return []
  }
}

export async function saveItem(item: AnyItemRecord): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('folder-items', item)
  } catch (error) {
    console.error('[bible-db] Failed to save item:', error)
  }
}

export async function saveItems(items: AnyItemRecord[]): Promise<void> {
  try {
    const db = await openBibleDB()
    const tx = db.transaction('folder-items', 'readwrite')
    await Promise.all([...items.map((i) => tx.store.put(i)), tx.done])
  } catch (error) {
    console.error('[bible-db] Failed to save items:', error)
  }
}

export async function deleteItem(id: string): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.delete('folder-items', id)
  } catch (error) {
    console.error('[bible-db] Failed to delete item:', error)
  }
}

export async function deleteItems(ids: string[]): Promise<void> {
  try {
    const db = await openBibleDB()
    const tx = db.transaction('folder-items', 'readwrite')
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
  } catch (error) {
    console.error('[bible-db] Failed to delete items:', error)
  }
}

export async function deleteItemsByParent(parentId: string): Promise<void> {
  try {
    const db = await openBibleDB()
    const items = await db.getAllKeysFromIndex('folder-items', 'by-parent', parentId)
    const tx = db.transaction('folder-items', 'readwrite')
    await Promise.all([...items.map((key) => tx.store.delete(key)), tx.done])
  } catch (error) {
    console.error('[bible-db] Failed to delete items by parent:', error)
  }
}

// ===== Cleanup =====

export async function deleteExpiredFolders(now: number): Promise<string[]> {
  try {
    const db = await openBibleDB()
    const all = await db.getAll('folder-records')
    const expired = all.filter((f) => f.expiresAt != null && f.expiresAt < now)
    if (expired.length === 0) return []
    const ids = expired.map((f) => f.id)
    await deleteFolders(ids)
    return ids
  } catch (error) {
    console.error('[bible-db] Failed to delete expired folders:', error)
    return []
  }
}

export async function deleteExpiredItems(now: number): Promise<string[]> {
  try {
    const db = await openBibleDB()
    const all = await db.getAll('folder-items')
    const expired = all.filter((i) => i.expiresAt != null && i.expiresAt < now)
    if (expired.length === 0) return []
    const ids = expired.map((i) => i.id)
    await deleteItems(ids)
    return ids
  } catch (error) {
    console.error('[bible-db] Failed to delete expired items:', error)
    return []
  }
}

// ===== Legacy (kept for compatibility during transition) =====

export async function saveFolderTree(rootId: string, folders: LegacyFolderDB[]): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('folders', folders, rootId)
  } catch (error) {
    console.error('[bible-db] Failed to save folder tree:', error)
  }
}

export async function loadFolderTree(rootId: string): Promise<LegacyFolderDB[] | undefined> {
  try {
    const db = await openBibleDB()
    return await db.get('folders', rootId)
  } catch (error) {
    console.error('[bible-db] Failed to load folder tree:', error)
    return undefined
  }
}

// ===== FlexSearch Cache =====

export async function saveFlexSearchCache(
  versionId: number,
  updatedAt: number,
  chunks: { key: string; data: string }[]
): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('flexsearch', { chunks, updatedAt }, versionId)
  } catch (error) {
    console.error('[bible-db] Failed to save flexsearch cache:', error)
  }
}

export async function loadFlexSearchCache(
  versionId: number,
  updatedAt: number
): Promise<{ key: string; data: string }[] | undefined> {
  try {
    const db = await openBibleDB()
    const record = await db.get('flexsearch', versionId)
    if (!record || record.updatedAt !== updatedAt) return undefined
    return record.chunks
  } catch (error) {
    console.error('[bible-db] Failed to load flexsearch cache:', error)
    return undefined
  }
}

export async function clearFlexSearchCache(versionId?: number): Promise<void> {
  try {
    const db = await openBibleDB()
    if (versionId) {
      await db.delete('flexsearch', versionId)
    } else {
      await db.clear('flexsearch')
    }
  } catch (error) {
    console.error('[bible-db] Failed to clear flexsearch cache:', error)
  }
}
