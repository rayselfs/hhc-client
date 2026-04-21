import type { FolderRecord, AnyItemRecord } from '@shared/types/folder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

export function createFolderDB(getDB: () => Promise<AnyDB>) {
  async function loadAllFolders(): Promise<FolderRecord[]> {
    try {
      const db = await getDB()
      return await db.getAll('folder-records')
    } catch (error) {
      console.error('[folder-db] Failed to load folders:', error)
      return []
    }
  }

  async function saveFolder(folder: FolderRecord): Promise<void> {
    try {
      const db = await getDB()
      await db.put('folder-records', folder)
    } catch (error) {
      console.error('[folder-db] Failed to save folder:', error)
    }
  }

  async function saveFolders(folders: FolderRecord[]): Promise<void> {
    try {
      const db = await getDB()
      const tx = db.transaction('folder-records', 'readwrite')
      await Promise.all([...folders.map((f: FolderRecord) => tx.store.put(f)), tx.done])
    } catch (error) {
      console.error('[folder-db] Failed to save folders:', error)
    }
  }

  async function deleteFolders(ids: string[]): Promise<void> {
    try {
      const db = await getDB()
      const tx = db.transaction('folder-records', 'readwrite')
      await Promise.all([...ids.map((id: string) => tx.store.delete(id)), tx.done])
    } catch (error) {
      console.error('[folder-db] Failed to delete folders:', error)
    }
  }

  async function loadItemsByParent(parentId: string): Promise<AnyItemRecord[]> {
    try {
      const db = await getDB()
      return await db.getAllFromIndex('folder-items', 'by-parent', parentId)
    } catch (error) {
      console.error('[folder-db] Failed to load items:', error)
      return []
    }
  }

  async function saveItem(item: AnyItemRecord): Promise<void> {
    try {
      const db = await getDB()
      await db.put('folder-items', item)
    } catch (error) {
      console.error('[folder-db] Failed to save item:', error)
    }
  }

  async function saveItems(items: AnyItemRecord[]): Promise<void> {
    try {
      const db = await getDB()
      const tx = db.transaction('folder-items', 'readwrite')
      await Promise.all([...items.map((i: AnyItemRecord) => tx.store.put(i)), tx.done])
    } catch (error) {
      console.error('[folder-db] Failed to save items:', error)
    }
  }

  async function deleteItem(id: string): Promise<void> {
    try {
      const db = await getDB()
      await db.delete('folder-items', id)
    } catch (error) {
      console.error('[folder-db] Failed to delete item:', error)
    }
  }

  async function deleteItems(ids: string[]): Promise<void> {
    try {
      const db = await getDB()
      const tx = db.transaction('folder-items', 'readwrite')
      await Promise.all([...ids.map((id: string) => tx.store.delete(id)), tx.done])
    } catch (error) {
      console.error('[folder-db] Failed to delete items:', error)
    }
  }

  async function deleteItemsByParent(parentId: string): Promise<void> {
    try {
      const db = await getDB()
      const items = await db.getAllKeysFromIndex('folder-items', 'by-parent', parentId)
      const tx = db.transaction('folder-items', 'readwrite')
      await Promise.all([...items.map((key: string) => tx.store.delete(key)), tx.done])
    } catch (error) {
      console.error('[folder-db] Failed to delete items by parent:', error)
    }
  }

  async function deleteExpiredFolders(now: number): Promise<string[]> {
    try {
      const all = await loadAllFolders()
      const expired = all.filter((f) => f.expiresAt != null && f.expiresAt < now)
      if (expired.length === 0) return []
      const ids = expired.map((f) => f.id)
      await deleteFolders(ids)
      return ids
    } catch (error) {
      console.error('[folder-db] Failed to delete expired folders:', error)
      return []
    }
  }

  async function deleteExpiredItems(now: number): Promise<string[]> {
    try {
      const db = await getDB()
      const all: AnyItemRecord[] = await db.getAll('folder-items')
      const expired = all.filter((i) => i.expiresAt != null && i.expiresAt < now)
      if (expired.length === 0) return []
      const ids = expired.map((i) => i.id)
      await deleteItems(ids)
      return ids
    } catch (error) {
      console.error('[folder-db] Failed to delete expired items:', error)
      return []
    }
  }

  return {
    loadAllFolders,
    saveFolder,
    saveFolders,
    deleteFolders,
    loadItemsByParent,
    saveItem,
    saveItems,
    deleteItem,
    deleteItems,
    deleteItemsByParent,
    deleteExpiredFolders,
    deleteExpiredItems
  }
}

export type FolderDBOperations = ReturnType<typeof createFolderDB>
