import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'

// Minimal type definitions for IndexedDB (matches T1/T2 types)
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

interface FolderDB {
  id: string
  name: string
  parentId: string | null
  items: unknown[]
  folders: FolderDB[]
  createdAt: number
  sortIndex?: number
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
    value: FolderDB[]
  }
  flexsearch: {
    key: number
    value: FlexSearchCacheDB
  }
}

const bibleDBPromise: Promise<IDBPDatabase<BibleDBSchema>> = openDB<BibleDBSchema>('hhc-bible', 1, {
  upgrade(db) {
    db.createObjectStore('content')
    db.createObjectStore('versions')
    db.createObjectStore('folders')
    db.createObjectStore('flexsearch')
  }
})

export async function openBibleDB(): Promise<IDBPDatabase<BibleDBSchema>> {
  return bibleDBPromise
}

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

export async function saveFolderTree(rootId: string, folders: FolderDB[]): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('folders', folders, rootId)
  } catch (error) {
    console.error('[bible-db] Failed to save folder tree:', error)
  }
}

export async function loadFolderTree(rootId: string): Promise<FolderDB[] | undefined> {
  try {
    const db = await openBibleDB()
    return await db.get('folders', rootId)
  } catch (error) {
    console.error('[bible-db] Failed to load folder tree:', error)
    return undefined
  }
}

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
