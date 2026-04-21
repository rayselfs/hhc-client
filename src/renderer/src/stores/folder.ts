import { create } from 'zustand'
import type { FolderRecord, AnyItemRecord, FolderStoreConfig } from '@shared/types/folder'
import { FOLDER_DURATION_MS } from '@shared/types/folder'
import {
  loadAllFolders,
  loadItemsByParent,
  saveFolder,
  saveFolders,
  deleteFolders,
  saveItem,
  saveItems,
  deleteItem as dbDeleteItem,
  deleteItems,
  deleteItemsByParent,
  deleteExpiredFolders,
  deleteExpiredItems
} from '@renderer/lib/bible-db'

interface FolderStoreState {
  folders: Record<string, FolderRecord>
  items: Record<string, AnyItemRecord>
  loadedParents: Set<string>
  currentFolderId: string
  isLoading: boolean

  initialize: () => Promise<void>
  addFolder: (name: string, parentId?: string, expiresAt?: number | null) => string
  updateFolder: (id: string, updates: { name?: string; expiresAt?: number | null }) => void
  deleteFolder: (id: string) => void
  addItem: (
    item: Omit<AnyItemRecord, 'id' | 'sortIndex' | 'createdAt' | 'expiresAt'> & {
      id?: string
      expiresAt?: number | null
    }
  ) => void
  removeItem: (id: string) => void
  moveItem: (itemId: string, targetFolderId: string) => void
  moveFolder: (folderId: string, targetFolderId: string) => void
  reorderItems: (parentId: string, orderedIds: string[]) => void
  reorderFolders: (parentId: string, orderedIds: string[]) => void
  navigateToFolder: (folderId: string) => Promise<void>
  navigateToRoot: () => void
  navigateUp: () => void
  cleanupExpired: () => Promise<void>
  ensureItemsLoaded: (parentId: string) => Promise<void>

  getChildFolders: (parentId: string) => FolderRecord[]
  getItems: (parentId: string) => AnyItemRecord[]
  getFolderPath: (folderId: string) => FolderRecord[]
  isItemsLoaded: (parentId: string) => boolean
}

export function createFolderStore(config: FolderStoreConfig) {
  return create<FolderStoreState>()((set, get) => ({
    folders: {},
    items: {},
    loadedParents: new Set<string>(),
    currentFolderId: config.rootId,
    isLoading: true,

    initialize: async () => {
      set({ isLoading: true })
      try {
        const allFolders = await loadAllFolders()
        const folderMap: Record<string, FolderRecord> = {}

        if (allFolders.length === 0) {
          const rootFolder: FolderRecord = {
            id: config.rootId,
            name: config.rootName,
            parentId: null,
            sortIndex: 0,
            createdAt: Date.now(),
            expiresAt: null
          }
          await saveFolder(rootFolder)
          folderMap[config.rootId] = rootFolder
        } else {
          for (const f of allFolders) {
            folderMap[f.id] = f
          }
          if (!folderMap[config.rootId]) {
            const rootFolder: FolderRecord = {
              id: config.rootId,
              name: config.rootName,
              parentId: null,
              sortIndex: 0,
              createdAt: Date.now(),
              expiresAt: null
            }
            await saveFolder(rootFolder)
            folderMap[config.rootId] = rootFolder
          }
        }

        const rootItems = await loadItemsByParent(config.rootId)
        const itemMap: Record<string, AnyItemRecord> = {}
        for (const item of rootItems) {
          itemMap[item.id] = item
        }

        set({
          folders: folderMap,
          items: itemMap,
          loadedParents: new Set([config.rootId]),
          isLoading: false
        })
      } catch {
        set({ isLoading: false })
      }
    },

    ensureItemsLoaded: async (parentId: string) => {
      const { loadedParents } = get()
      if (loadedParents.has(parentId)) return
      const items = await loadItemsByParent(parentId)
      set((state) => {
        const newItems = { ...state.items }
        for (const item of items) {
          newItems[item.id] = item
        }
        const newLoaded = new Set(state.loadedParents)
        newLoaded.add(parentId)
        return { items: newItems, loadedParents: newLoaded }
      })
    },

    addFolder: (name, parentId, expiresAt) => {
      const resolvedParentId = parentId ?? get().currentFolderId
      const siblings = get().getChildFolders(resolvedParentId)
      const newFolder: FolderRecord = {
        id: crypto.randomUUID(),
        name,
        parentId: resolvedParentId,
        sortIndex: siblings.length,
        createdAt: Date.now(),
        expiresAt: expiresAt !== undefined ? expiresAt : null
      }
      set((state) => ({
        folders: { ...state.folders, [newFolder.id]: newFolder }
      }))
      saveFolder(newFolder)
      return newFolder.id
    },

    updateFolder: (id, updates) => {
      if (id === config.rootId) return
      const folder = get().folders[id]
      if (!folder) return
      const updated = { ...folder, ...updates }
      set((state) => ({
        folders: { ...state.folders, [id]: updated }
      }))
      saveFolder(updated)
    },

    deleteFolder: (id) => {
      if (id === config.rootId) return
      const { folders, items, currentFolderId } = get()

      const descendantIds = getDescendantFolderIds(id, folders)
      const allFolderIds = [id, ...descendantIds]

      const newFolders = { ...folders }
      const newItems = { ...items }
      const itemIdsToDelete: string[] = []

      for (const fid of allFolderIds) {
        delete newFolders[fid]
        for (const item of Object.values(newItems)) {
          if (item.parentId === fid) {
            itemIdsToDelete.push(item.id)
            delete newItems[item.id]
          }
        }
      }

      const nextCurrentId = allFolderIds.includes(currentFolderId) ? config.rootId : currentFolderId

      set({ folders: newFolders, items: newItems, currentFolderId: nextCurrentId })
      deleteFolders(allFolderIds)
      if (itemIdsToDelete.length > 0) deleteItems(itemIdsToDelete)
    },

    addItem: (itemData) => {
      const parentId = itemData.parentId || get().currentFolderId
      const isRoot = parentId === config.rootId
      const siblings = get().getItems(parentId)
      const item: AnyItemRecord = {
        ...itemData,
        id: itemData.id || crypto.randomUUID(),
        parentId,
        sortIndex: siblings.length,
        createdAt: Date.now(),
        expiresAt:
          itemData.expiresAt !== undefined
            ? itemData.expiresAt
            : isRoot
              ? Date.now() + FOLDER_DURATION_MS['1day']
              : null
      } as AnyItemRecord
      set((state) => ({
        items: { ...state.items, [item.id]: item }
      }))
      saveItem(item)
    },

    removeItem: (id) => {
      set((state) => {
        const newItems = { ...state.items }
        delete newItems[id]
        return { items: newItems }
      })
      dbDeleteItem(id)
    },

    moveItem: (itemId, targetFolderId) => {
      const item = get().items[itemId]
      if (!item || item.parentId === targetFolderId) return
      const targetSiblings = get().getItems(targetFolderId)
      const updated: AnyItemRecord = {
        ...item,
        parentId: targetFolderId,
        sortIndex: targetSiblings.length
      }
      set((state) => ({
        items: { ...state.items, [itemId]: updated }
      }))
      saveItem(updated)
    },

    moveFolder: (folderId, targetFolderId) => {
      if (folderId === config.rootId || folderId === targetFolderId) return
      const folder = get().folders[folderId]
      if (!folder) return

      const descendants = getDescendantFolderIds(folderId, get().folders)
      if (descendants.includes(targetFolderId)) return

      const targetSiblings = get().getChildFolders(targetFolderId)
      const updated: FolderRecord = {
        ...folder,
        parentId: targetFolderId,
        sortIndex: targetSiblings.length
      }
      set((state) => ({
        folders: { ...state.folders, [folderId]: updated }
      }))
      saveFolder(updated)
    },

    reorderItems: (_parentId, orderedIds) => {
      const { items } = get()
      const updated: AnyItemRecord[] = []
      for (let i = 0; i < orderedIds.length; i++) {
        const item = items[orderedIds[i]]
        if (item) {
          updated.push({ ...item, sortIndex: i })
        }
      }
      set((state) => {
        const newItems = { ...state.items }
        for (const item of updated) {
          newItems[item.id] = item
        }
        return { items: newItems }
      })
      saveItems(updated)
    },

    reorderFolders: (_parentId, orderedIds) => {
      const { folders } = get()
      const updated: FolderRecord[] = []
      for (let i = 0; i < orderedIds.length; i++) {
        const folder = folders[orderedIds[i]]
        if (folder) {
          updated.push({ ...folder, sortIndex: i })
        }
      }
      set((state) => {
        const newFolders = { ...state.folders }
        for (const folder of updated) {
          newFolders[folder.id] = folder
        }
        return { folders: newFolders }
      })
      saveFolders(updated)
    },

    navigateToFolder: async (folderId) => {
      const { folders } = get()
      if (!folders[folderId]) return
      set({ currentFolderId: folderId })
      await get().ensureItemsLoaded(folderId)
    },

    navigateToRoot: () => {
      set({ currentFolderId: config.rootId })
    },

    navigateUp: () => {
      const { folders, currentFolderId } = get()
      if (currentFolderId === config.rootId) return
      const current = folders[currentFolderId]
      set({ currentFolderId: current?.parentId ?? config.rootId })
    },

    cleanupExpired: async () => {
      const now = Date.now()
      const expiredFolderIds = await deleteExpiredFolders(now)
      const expiredItemIds = await deleteExpiredItems(now)

      if (expiredFolderIds.length === 0 && expiredItemIds.length === 0) return

      const { folders } = get()

      let cascadeFolderIds: string[] = []
      for (const fid of expiredFolderIds) {
        cascadeFolderIds = [...cascadeFolderIds, ...getDescendantFolderIds(fid, folders)]
      }
      const allExpiredFolderIds = [...expiredFolderIds, ...cascadeFolderIds]
      if (cascadeFolderIds.length > 0) {
        await deleteFolders(cascadeFolderIds)
        for (const fid of cascadeFolderIds) {
          await deleteItemsByParent(fid)
        }
      }

      set((state) => {
        const newFolders = { ...state.folders }
        const newItems = { ...state.items }
        for (const id of allExpiredFolderIds) delete newFolders[id]
        for (const id of expiredItemIds) delete newItems[id]
        for (const item of Object.values(newItems)) {
          if (allExpiredFolderIds.includes(item.parentId)) {
            delete newItems[item.id]
          }
        }
        return { folders: newFolders, items: newItems }
      })
    },

    getChildFolders: (parentId) => {
      const { folders } = get()
      return Object.values(folders)
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.sortIndex - b.sortIndex)
    },

    getItems: (parentId) => {
      const { items } = get()
      return Object.values(items)
        .filter((i) => i.parentId === parentId)
        .sort((a, b) => a.sortIndex - b.sortIndex)
    },

    getFolderPath: (folderId) => {
      const { folders } = get()
      const path: FolderRecord[] = []
      let current = folders[folderId]
      while (current) {
        path.unshift(current)
        if (current.parentId === null) break
        current = folders[current.parentId]
      }
      return path
    },

    isItemsLoaded: (parentId) => {
      return get().loadedParents.has(parentId)
    }
  }))
}

function getDescendantFolderIds(folderId: string, folders: Record<string, FolderRecord>): string[] {
  const result: string[] = []
  const queue = [folderId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const f of Object.values(folders)) {
      if (f.parentId === current && f.id !== folderId) {
        result.push(f.id)
        queue.push(f.id)
      }
    }
  }
  return result
}

export const useBibleFolderStore = createFolderStore({
  rootId: 'bible-root',
  rootName: 'Bible Library',
  dbName: 'hhc-bible'
})
