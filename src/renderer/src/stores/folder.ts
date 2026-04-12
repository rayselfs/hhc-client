import { create } from 'zustand'
import type { UseBoundStore, StoreApi } from 'zustand'
import type { Folder, FolderItem, FolderStoreConfig, VerseItem } from '@shared/types/folder'
import { saveFolderTree, loadFolderTree } from '@renderer/lib/bible-db'

export function findFolder<T extends FolderItem>(
  root: Folder<T>,
  id: string
): Folder<T> | undefined {
  if (root.id === id) return root
  for (const child of root.folders) {
    const found = findFolder(child, id)
    if (found) return found
  }
  return undefined
}

export function flattenFolders<T extends FolderItem>(root: Folder<T>): Folder<T>[] {
  const result: Folder<T>[] = [root]
  for (const child of root.folders) {
    result.push(...flattenFolders(child))
  }
  return result
}

function makeRoot<T extends FolderItem>(config: FolderStoreConfig): Folder<T> {
  return {
    id: config.rootId,
    name: config.rootName,
    parentId: null,
    items: [],
    folders: [],
    createdAt: Date.now()
  }
}

function updateFolderInTree<T extends FolderItem>(
  root: Folder<T>,
  targetId: string,
  updater: (folder: Folder<T>) => Folder<T>
): Folder<T> {
  if (root.id === targetId) return updater(root)
  return {
    ...root,
    folders: root.folders.map((child) => updateFolderInTree(child, targetId, updater))
  }
}

function removeFolderFromTree<T extends FolderItem>(root: Folder<T>, targetId: string): Folder<T> {
  return {
    ...root,
    folders: root.folders
      .filter((f) => f.id !== targetId)
      .map((child) => removeFolderFromTree(child, targetId))
  }
}

function removeItemFromTree<T extends FolderItem>(root: Folder<T>, itemId: string): Folder<T> {
  return {
    ...root,
    items: root.items.filter((i) => i.id !== itemId),
    folders: root.folders.map((child) => removeItemFromTree(child, itemId))
  }
}

function persistTree<T extends FolderItem>(rootId: string, root: Folder<T>): void {
  saveFolderTree(rootId, [root] as never)
}

interface FolderStoreState<TItem extends FolderItem> {
  root: Folder<TItem>
  currentFolderId: string
  isLoading: boolean
  initialize: () => Promise<void>
  addFolder: (name: string, parentId?: string) => void
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  addItem: (item: TItem, folderId?: string) => void
  removeItem: (id: string) => void
  moveItem: (itemId: string, targetFolderId: string) => void
  moveFolder: (folderId: string, targetFolderId: string) => void
  reorderItems: (folderId: string, orderedIds: string[]) => void
  navigateToFolder: (folderId: string) => void
  navigateToRoot: () => void
  navigateUp: () => void
  getCurrentFolder: () => Folder<TItem>
}

export function createFolderStore<TItem extends FolderItem>(
  config: FolderStoreConfig
): UseBoundStore<StoreApi<FolderStoreState<TItem>>> {
  return create<FolderStoreState<TItem>>()((set, get) => ({
    root: makeRoot<TItem>(config),
    currentFolderId: config.rootId,
    isLoading: false,

    initialize: async () => {
      set({ isLoading: true })
      try {
        const stored = await loadFolderTree(config.rootId)
        if (stored && stored.length > 0) {
          set({ root: stored[0] as unknown as Folder<TItem>, isLoading: false })
        } else {
          const root = makeRoot<TItem>(config)
          set({ root, isLoading: false })
          persistTree(config.rootId, root)
        }
      } catch {
        set({ isLoading: false })
      }
    },

    addFolder: (name, parentId) => {
      const { root } = get()
      const resolvedParentId = parentId ?? config.rootId
      if (resolvedParentId !== config.rootId) {
        console.warn('[FolderStore] addFolder: only root-level folders allowed')
        return
      }
      const newFolder: Folder<TItem> = {
        id: crypto.randomUUID(),
        name,
        parentId: config.rootId,
        items: [],
        folders: [],
        createdAt: Date.now(),
        sortIndex: root.folders.length
      }
      const updated = { ...root, folders: [...root.folders, newFolder] }
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    renameFolder: (id, name) => {
      if (id === config.rootId) return
      const { root } = get()
      const updated = updateFolderInTree(root, id, (f) => ({ ...f, name }))
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    deleteFolder: (id) => {
      if (id === config.rootId) return
      const { root, currentFolderId } = get()
      const updated = removeFolderFromTree(root, id)
      const nextCurrentId = currentFolderId === id ? config.rootId : currentFolderId
      set({ root: updated, currentFolderId: nextCurrentId })
      persistTree(config.rootId, updated)
    },

    addItem: (item, folderId) => {
      const { root, currentFolderId } = get()
      const targetId = folderId ?? currentFolderId
      const updated = updateFolderInTree(root, targetId, (f) => ({
        ...f,
        items: [...f.items, { ...item, sortIndex: f.items.length }]
      }))
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    removeItem: (id) => {
      const { root } = get()
      const updated = removeItemFromTree(root, id)
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    moveItem: (itemId, targetFolderId) => {
      const { root } = get()
      const allFolders = flattenFolders(root)
      let foundItem: TItem | undefined
      for (const folder of allFolders) {
        const item = folder.items.find((i) => i.id === itemId)
        if (item) {
          foundItem = item
          break
        }
      }
      if (!foundItem) return
      const itemToMove = foundItem
      const withoutItem = removeItemFromTree(root, itemId)
      const updated = updateFolderInTree(withoutItem, targetFolderId, (f) => ({
        ...f,
        items: [...f.items, { ...itemToMove, sortIndex: f.items.length }]
      }))
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    moveFolder: (folderId, targetFolderId) => {
      if (targetFolderId !== config.rootId) {
        console.warn('[FolderStore] moveFolder: target must be root (max 1 level nesting)')
        return
      }
      const { root } = get()
      if (folderId === config.rootId) return
      const folderToMove = findFolder(root, folderId)
      if (!folderToMove) return
      const withoutFolder = removeFolderFromTree(root, folderId)
      const updated = {
        ...withoutFolder,
        folders: [
          ...withoutFolder.folders,
          { ...folderToMove, parentId: config.rootId, sortIndex: withoutFolder.folders.length }
        ]
      }
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    reorderItems: (folderId, orderedIds) => {
      const { root } = get()
      const updated = updateFolderInTree(root, folderId, (f) => {
        const reordered: TItem[] = orderedIds
          .map((id, index) => {
            const item = f.items.find((i) => i.id === id)
            return item ? ({ ...item, sortIndex: index } as TItem) : undefined
          })
          .filter((i): i is TItem => i !== undefined)
        const missing = f.items.filter((i) => !orderedIds.includes(i.id))
        return { ...f, items: [...reordered, ...missing] }
      })
      set({ root: updated })
      persistTree(config.rootId, updated)
    },

    navigateToFolder: (folderId) => {
      const { root } = get()
      if (findFolder(root, folderId)) {
        set({ currentFolderId: folderId })
      }
    },

    navigateToRoot: () => {
      set({ currentFolderId: config.rootId })
    },

    navigateUp: () => {
      const { root, currentFolderId } = get()
      if (currentFolderId === config.rootId) return
      const current = findFolder(root, currentFolderId)
      if (current?.parentId) {
        set({ currentFolderId: current.parentId })
      } else {
        set({ currentFolderId: config.rootId })
      }
    },

    getCurrentFolder: () => {
      const { root, currentFolderId } = get()
      return findFolder(root, currentFolderId) ?? root
    }
  }))
}

export const useBibleFolderStore = createFolderStore<VerseItem>({
  rootId: 'bible-root',
  rootName: 'Bible Library',
  dbName: 'hhc-bible'
})
