import { create } from 'zustand'
import type { FolderRecord, AnyItemRecord, FolderStoreConfig } from '@shared/types/folder'
import { FOLDER_DURATION_MS } from '@shared/types/folder'
import { createFolderDB } from '@renderer/lib/folder-db'
import { openBibleDB } from '@renderer/lib/bible-db'
import { incrementBlobRef, openFileExplorerDB } from '@renderer/lib/file-explorer-db'

export interface FolderStoreState {
  folders: Record<string, FolderRecord>
  items: Record<string, AnyItemRecord>
  _foldersArray: FolderRecord[]
  _itemsArray: AnyItemRecord[]
  loadedParents: Set<string>
  currentFolderId: string
  isLoading: boolean

  initialize: () => Promise<void>
  addFolder: (name: string, parentId?: string, expiresAt?: number | null) => string
  updateFolder: (id: string, updates: { name?: string; expiresAt?: number | null }) => void
  updateItem?: (id: string, updates: Partial<AnyItemRecord>) => void
  deleteFolder: (id: string) => void
  addItem: (
    item: Omit<AnyItemRecord, 'id' | 'sortIndex' | 'createdAt' | 'expiresAt'> & {
      id?: string
      expiresAt?: number | null
    }
  ) => void
  removeItem: (id: string) => void
  moveItem: (itemId: string, targetFolderId: string) => void
  copyItem: (itemId: string, targetFolderId: string) => Promise<string | null>
  moveFolder: (folderId: string, targetFolderId: string) => void
  reorderItems: (parentId: string, orderedIds: string[]) => void
  reorderFolders: (parentId: string, orderedIds: string[]) => void
  navigateToFolder: (folderId: string) => Promise<void>
  navigateToRoot: () => void
  navigateUp: () => void
  cleanupExpired: () => Promise<void>
  softDeleteExpired: () => void
  ensureItemsLoaded: (parentId: string) => Promise<void>
  toggleFavorite: (folderId: string) => void
  softDeleteFolder: (folderId: string) => void
  softDeleteItem: (itemId: string) => void
  restoreFolder: (folderId: string) => void
  restoreItem: (itemId: string) => void
  purgeTrash: (retentionMs: number) => Promise<void>

  getChildFolders: (parentId: string) => FolderRecord[]
  getItems: (parentId: string) => AnyItemRecord[]
  getFolderPath: (folderId: string) => FolderRecord[]
  isItemsLoaded: (parentId: string) => boolean
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createFolderStore(config: FolderStoreConfig) {
  const ops = createFolderDB(config.getDB, config.rootId)
  return create<FolderStoreState>()((set, get) => ({
    folders: {},
    items: {},
    _foldersArray: [],
    _itemsArray: [],
    loadedParents: new Set<string>(),
    currentFolderId: config.rootId,
    isLoading: true,

    initialize: async () => {
      if (get()._foldersArray.length > 0) return
      set({ isLoading: true })
      try {
        const allFolders = await ops.loadAllFolders()
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
          await ops.saveFolder(rootFolder)
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
            await ops.saveFolder(rootFolder)
            folderMap[config.rootId] = rootFolder
          }
        }

        const rootItems = await ops.loadItemsByParent(config.rootId)
        const itemMap: Record<string, AnyItemRecord> = {}
        for (const item of rootItems) {
          itemMap[item.id] = item
        }

        set({
          folders: folderMap,
          items: itemMap,
          _foldersArray: Object.values(folderMap),
          _itemsArray: Object.values(itemMap),
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
      const items = await ops.loadItemsByParent(parentId)
      set((state) => {
        const newItems = { ...state.items }
        for (const item of items) {
          newItems[item.id] = item
        }
        const newLoaded = new Set(state.loadedParents)
        newLoaded.add(parentId)
        return { items: newItems, _itemsArray: Object.values(newItems), loadedParents: newLoaded }
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
        expiresAt:
          expiresAt !== undefined
            ? expiresAt
            : resolvedParentId === config.rootId
              ? Date.now() + FOLDER_DURATION_MS['1day']
              : (get().folders[resolvedParentId]?.expiresAt ?? null)
      }
      set((state) => ({
        folders: { ...state.folders, [newFolder.id]: newFolder },
        _foldersArray: [...state._foldersArray, newFolder]
      }))
      ops.saveFolder(newFolder)
      return newFolder.id
    },

    updateFolder: (id, updates) => {
      if (id === config.rootId) return
      const folder = get().folders[id]
      if (!folder) return
      const updated = { ...folder, ...updates }
      set((state) => {
        const newFoldersArray = state._foldersArray.map((f) => (f.id === id ? updated : f))
        return {
          folders: { ...state.folders, [id]: updated },
          _foldersArray: newFoldersArray
        }
      })
      ops.saveFolder(updated)
    },

    updateItem: (id, updates) => {
      const item = get().items[id]
      if (!item) return
      const updated = { ...item, ...updates } as AnyItemRecord
      set((state) => {
        const newItemsArray = state._itemsArray.map((entry) => (entry.id === id ? updated : entry))
        return {
          items: { ...state.items, [id]: updated },
          _itemsArray: newItemsArray
        }
      })
      ops.saveItem(updated)
    },

    deleteFolder: (id) => {
      if (id === config.rootId) return
      const { folders, items, currentFolderId } = get()

      const descendantIds = getDescendantFolderIds(id, folders)
      const allFolderIds = [id, ...descendantIds]
      const folderIdSet = new Set(allFolderIds)

      const newFolders = { ...folders }
      for (const fid of allFolderIds) delete newFolders[fid]

      const itemIdsToDelete: string[] = []
      const newItems = Object.fromEntries(
        Object.entries(items).filter(([, item]) => {
          if (folderIdSet.has(item.parentId)) {
            itemIdsToDelete.push(item.id)
            return false
          }
          return true
        })
      )

      const nextCurrentId = allFolderIds.includes(currentFolderId) ? config.rootId : currentFolderId

      set({
        folders: newFolders,
        items: newItems,
        _foldersArray: Object.values(newFolders),
        _itemsArray: Object.values(newItems),
        currentFolderId: nextCurrentId
      })
      ops.deleteFolders(allFolderIds)
      if (itemIdsToDelete.length > 0) ops.deleteItems(itemIdsToDelete)
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
        items: { ...state.items, [item.id]: item },
        _itemsArray: [...state._itemsArray, item]
      }))
      ops.saveItem(item)
    },

    removeItem: (id) => {
      set((state) => {
        const newItems = { ...state.items }
        delete newItems[id]
        return { items: newItems, _itemsArray: Object.values(newItems) }
      })
      ops.deleteItem(id)
    },

    moveItem: (itemId, targetFolderId) => {
      const item = get().items[itemId]
      if (!item || item.parentId === targetFolderId) return
      const targetSiblings = get().getItems(targetFolderId)
      const updated: AnyItemRecord = {
        ...item,
        parentId: targetFolderId,
        sortIndex: targetSiblings.length,
        expiresAt: targetFolderId === config.rootId ? Date.now() + FOLDER_DURATION_MS['1day'] : null
      }
      set((state) => {
        const newItemsArray = state._itemsArray.map((i) => (i.id === itemId ? updated : i))
        return {
          items: { ...state.items, [itemId]: updated },
          _itemsArray: newItemsArray
        }
      })
      ops.saveItem(updated)
    },

    copyItem: async (itemId, targetFolderId) => {
      const sourceItem = get().items[itemId]
      if (!sourceItem || sourceItem.type !== 'file') return null

      const blobId = sourceItem.url.replace(/^blob:/, '')
      const newId = crypto.randomUUID()
      const targetSiblings = get().getItems(targetFolderId)
      const now = Date.now()
      const copiedItem: AnyItemRecord = {
        ...sourceItem,
        id: newId,
        parentId: targetFolderId,
        sortIndex: targetSiblings.length,
        createdAt: now,
        expiresAt: targetFolderId === config.rootId ? now + FOLDER_DURATION_MS['1day'] : null,
        deletedAt: undefined,
        originalParentId: undefined
      }

      const db = await openFileExplorerDB()
      await incrementBlobRef(db, blobId)

      set((state) => ({
        items: { ...state.items, [copiedItem.id]: copiedItem },
        _itemsArray: [...state._itemsArray, copiedItem]
      }))
      ops.saveItem(copiedItem)
      return newId
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
      set((state) => {
        const newFoldersArray = state._foldersArray.map((f) => (f.id === folderId ? updated : f))
        return {
          folders: { ...state.folders, [folderId]: updated },
          _foldersArray: newFoldersArray
        }
      })
      ops.saveFolder(updated)
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
        return { items: newItems, _itemsArray: Object.values(newItems) }
      })
      ops.saveItems(updated)
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
        return { folders: newFolders, _foldersArray: Object.values(newFolders) }
      })
      ops.saveFolders(updated)
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

    toggleFavorite: (folderId) => {
      if (folderId === config.rootId) return
      const folder = get().folders[folderId]
      if (!folder) return
      let updated: FolderRecord
      if (!folder.isFavorited) {
        updated = { ...folder, isFavorited: true, expiresAt: null }
      } else {
        updated = { ...folder, isFavorited: false }
      }
      set((state) => ({
        folders: { ...state.folders, [folderId]: updated },
        _foldersArray: state._foldersArray.map((f) => (f.id === folderId ? updated : f))
      }))
      ops.saveFolder(updated)
    },

    softDeleteFolder: (folderId) => {
      if (folderId === config.rootId) return
      const { folders } = get()
      const folder = folders[folderId]
      if (!folder) return

      const descendantIds = getDescendantFolderIds(folderId, folders)

      const updated: FolderRecord = {
        ...folder,
        isFavorited: false,
        deletedAt: Date.now(),
        originalParentId: folder.parentId ?? config.rootId
      }

      const descendantUpdates: FolderRecord[] = []
      for (const id of descendantIds) {
        const f = folders[id]
        if (f?.isFavorited) descendantUpdates.push({ ...f, isFavorited: false })
      }

      set((state) => {
        const newFolders = { ...state.folders, [folderId]: updated }
        for (const f of descendantUpdates) newFolders[f.id] = f
        return {
          folders: newFolders,
          _foldersArray: state._foldersArray.map((f) => newFolders[f.id] ?? f)
        }
      })

      ops.saveFolder(updated)
      if (descendantUpdates.length > 0) ops.saveFolders(descendantUpdates)
    },

    softDeleteItem: (itemId) => {
      const item = get().items[itemId]
      if (!item) return
      const updated: AnyItemRecord = {
        ...item,
        deletedAt: Date.now(),
        originalParentId: item.parentId
      }
      set((state) => ({
        items: { ...state.items, [itemId]: updated },
        _itemsArray: state._itemsArray.map((i) => (i.id === itemId ? updated : i))
      }))
      ops.saveItem(updated)
    },

    restoreFolder: (folderId) => {
      const { folders } = get()
      const folder = folders[folderId]
      if (!folder || !folder.deletedAt) return
      const parentId = folder.originalParentId
      const targetParentId =
        parentId && folders[parentId] && !folders[parentId].deletedAt ? parentId : config.rootId
      const updated: FolderRecord = {
        ...folder,
        isFavorited: false,
        parentId: targetParentId,
        deletedAt: undefined,
        originalParentId: undefined
      }
      set((state) => ({
        folders: { ...state.folders, [folderId]: updated },
        _foldersArray: state._foldersArray.map((f) => (f.id === folderId ? updated : f))
      }))
      ops.saveFolder(updated)
    },

    restoreItem: (itemId) => {
      const { items, folders } = get()
      const item = items[itemId]
      if (!item || !item.deletedAt) return
      const parentId = item.originalParentId
      const targetParentId =
        parentId && folders[parentId] && !folders[parentId].deletedAt ? parentId : config.rootId
      const updated: AnyItemRecord = {
        ...item,
        parentId: targetParentId,
        deletedAt: undefined,
        originalParentId: undefined
      }
      set((state) => ({
        items: { ...state.items, [itemId]: updated },
        _itemsArray: state._itemsArray.map((i) => (i.id === itemId ? updated : i))
      }))
      ops.saveItem(updated)
    },

    purgeTrash: async (retentionMs) => {
      const { folderIds, itemIds } = await ops.purgeTrashOlderThan(Date.now(), retentionMs)
      if (folderIds.length === 0 && itemIds.length === 0) return
      set((state) => {
        const newFolders = { ...state.folders }
        const newItems = { ...state.items }
        const folderIdSet = new Set(folderIds)
        for (const id of folderIds) delete newFolders[id]
        for (const id of itemIds) delete newItems[id]
        for (const item of Object.values(newItems)) {
          if (folderIdSet.has(item.parentId)) delete newItems[item.id]
        }
        return {
          folders: newFolders,
          items: newItems,
          _foldersArray: Object.values(newFolders),
          _itemsArray: Object.values(newItems)
        }
      })
    },

    cleanupExpired: async () => {
      const now = Date.now()
      const expiredFolderIds = await ops.deleteExpiredFolders(now)
      const expiredItemIds = await ops.deleteExpiredItems(now)

      if (expiredFolderIds.length === 0 && expiredItemIds.length === 0) return

      const { folders } = get()

      let cascadeFolderIds: string[] = []
      for (const fid of expiredFolderIds) {
        cascadeFolderIds = [...cascadeFolderIds, ...getDescendantFolderIds(fid, folders)]
      }
      const allExpiredFolderIds = [...expiredFolderIds, ...cascadeFolderIds]
      for (const fid of expiredFolderIds) {
        await ops.deleteItemsByParent(fid)
      }
      if (cascadeFolderIds.length > 0) {
        await ops.deleteFolders(cascadeFolderIds)
        for (const fid of cascadeFolderIds) {
          await ops.deleteItemsByParent(fid)
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
        return {
          folders: newFolders,
          items: newItems,
          _foldersArray: Object.values(newFolders),
          _itemsArray: Object.values(newItems)
        }
      })
    },

    softDeleteExpired: () => {
      const now = Date.now()
      const { folders, items } = get()
      for (const folder of Object.values(folders)) {
        if (
          folder.expiresAt != null &&
          folder.expiresAt < now &&
          !folder.deletedAt &&
          folder.id !== config.rootId
        ) {
          get().softDeleteFolder(folder.id)
        }
      }
      for (const item of Object.values(items)) {
        if (item.expiresAt != null && item.expiresAt < now && !item.deletedAt) {
          get().softDeleteItem(item.id)
        }
      }
    },

    getChildFolders: (parentId) => {
      const { _foldersArray } = get()
      return _foldersArray
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.sortIndex - b.sortIndex)
    },

    getItems: (parentId) => {
      const { _itemsArray } = get()
      return _itemsArray
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
  // Build adjacency map once: O(n)
  const childrenByParent = new Map<string, string[]>()
  for (const f of Object.values(folders)) {
    if (f.parentId) {
      const list = childrenByParent.get(f.parentId) ?? []
      list.push(f.id)
      childrenByParent.set(f.parentId, list)
    }
  }
  // O(n) BFS
  const result: string[] = []
  const queue = [...(childrenByParent.get(folderId) ?? [])]
  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)
    const children = childrenByParent.get(current)
    if (children) queue.push(...children)
  }
  return result
}

export const useBibleFolderStore = createFolderStore({
  rootId: 'bible-root',
  rootName: 'Bible Library',
  getDB: () => openBibleDB()
})
