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
  id: string
  code: string
  name: string
  updatedAt: string
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

interface BibleDBSchema extends DBSchema {
  content: {
    key: string
    value: BibleBookDB[]
  }
  versions: {
    key: string
    value: BibleVersionDB[]
  }
  folders: {
    key: string
    value: FolderDB[]
  }
}

export async function openBibleDB(): Promise<IDBPDatabase<BibleDBSchema>> {
  return openDB<BibleDBSchema>('hhc-bible', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('content')) {
        db.createObjectStore('content')
      }
      if (!db.objectStoreNames.contains('versions')) {
        db.createObjectStore('versions')
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders')
      }
    }
  })
}

export async function saveBibleContent(versionId: string, content: BibleBookDB[]): Promise<void> {
  try {
    const db = await openBibleDB()
    await db.put('content', content, versionId)
  } catch (error) {
    console.error('[bible-db] Failed to save content:', error)
  }
}

export async function loadBibleContent(versionId: string): Promise<BibleBookDB[] | undefined> {
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
    await db.put('versions', versions, 'versions')
  } catch (error) {
    console.error('[bible-db] Failed to save version metadata:', error)
  }
}

export async function loadBibleVersionMeta(): Promise<BibleVersionDB[] | undefined> {
  try {
    const db = await openBibleDB()
    return await db.get('versions', 'versions')
  } catch (error) {
    console.error('[bible-db] Failed to load version metadata:', error)
    return undefined
  }
}

export async function clearBibleContent(versionId?: string): Promise<void> {
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
