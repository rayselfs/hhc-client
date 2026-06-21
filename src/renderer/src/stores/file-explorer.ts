import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UseBoundStore, StoreApi } from 'zustand'
import { deleteFileBlob, openFileExplorerDB, storeFileBlob } from '@renderer/lib/file-explorer-db'
import { hhcPersistStorage, createPersistName } from '@renderer/lib/persist-storage'
import { createFolderStore } from '@renderer/stores/folder'
import type { FileExplorerViewMode, FileItemRecord } from '@shared/types/folder'
import {
  cleanupFileResources,
  purgeExpiredFileTrash,
  type CleanupResult
} from '@renderer/lib/file-resource-cleanup'

export type SortField = 'name' | 'createdAt' | 'size' | 'kind'
export type SortDir = 'asc' | 'desc' | 'none'

interface FileExplorerSettingsState {
  viewMode: FileExplorerViewMode
  setViewMode: (mode: FileExplorerViewMode) => void
  sortField: SortField
  sortDir: SortDir
  setSortField: (field: SortField) => void
  setSortDir: (dir: SortDir) => void
  setSortFieldAndDir: (field: SortField, dir: SortDir) => void
  colWidths: { created: number; size: number; kind: number }
  setColWidths: (widths: Partial<{ created: number; size: number; kind: number }>) => void
}

interface FileExplorerSearchState {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const FILE_EXPLORER_ROOT_ID = 'file-root'

export const useFileExplorerStore = createFolderStore({
  rootId: FILE_EXPLORER_ROOT_ID,
  rootName: 'Files',
  getDB: () => openFileExplorerDB()
})

function createExplorerSettingsStore(
  persistName: string,
  defaults: { sortField: SortField; sortDir: SortDir },
  options: { version?: number; migrate?: (state: unknown) => unknown } = {}
): UseBoundStore<StoreApi<FileExplorerSettingsState>> {
  return create<FileExplorerSettingsState>()(
    persist(
      (set) => ({
        viewMode: 'medium-icon',
        setViewMode: (viewMode) => set({ viewMode }),
        sortField: defaults.sortField,
        sortDir: defaults.sortDir,
        setSortField: (sortField) => set({ sortField }),
        setSortDir: (sortDir) => set({ sortDir }),
        setSortFieldAndDir: (sortField, sortDir) => set({ sortField, sortDir }),
        colWidths: { created: 112, size: 80, kind: 96 },
        setColWidths: (widths) => set((state) => ({ colWidths: { ...state.colWidths, ...widths } }))
      }),
      {
        name: createPersistName(persistName),
        storage: hhcPersistStorage,
        version: options.version ?? 0,
        ...(options.migrate ? { migrate: options.migrate } : {}),
        partialize: (state) => ({
          viewMode: state.viewMode,
          sortField: state.sortField,
          sortDir: state.sortDir,
          colWidths: state.colWidths
        })
      }
    )
  )
}

export const useFileExplorerSettings = createExplorerSettingsStore(
  'file-explorer-settings',
  { sortField: 'createdAt', sortDir: 'none' },
  { version: 1, migrate: (state) => state }
)

export const useFileExplorerSearch = create<FileExplorerSearchState>()((set) => ({
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery })
}))

export const useFavoritesExplorerSettings = createExplorerSettingsStore(
  'favorites-explorer-settings',
  { sortField: 'name', sortDir: 'asc' }
)

export const useTrashExplorerSettings = createExplorerSettingsStore('trash-explorer-settings', {
  sortField: 'createdAt',
  sortDir: 'desc'
})

interface FileExplorerCustomOrderState {
  orders: Record<string, string[]>
  setOrder: (folderId: string, orderedIds: string[]) => void
}

export const useFileExplorerCustomOrder = create<FileExplorerCustomOrderState>()(
  persist(
    (set) => ({
      orders: {},
      setOrder: (folderId, orderedIds) =>
        set((state) => ({ orders: { ...state.orders, [folderId]: orderedIds } }))
    }),
    {
      name: createPersistName('file-explorer-custom-order'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({ orders: state.orders })
    }
  )
)

export async function addFileItemToStore(
  file: File,
  parentId: string,
  canonicalMimeType = file.type || 'application/octet-stream'
): Promise<string> {
  const db = await openFileExplorerDB()
  const id = crypto.randomUUID()

  await storeFileBlob(db, id, file)

  const item: Omit<FileItemRecord, 'sortIndex' | 'createdAt' | 'expiresAt'> = {
    id,
    parentId,
    type: 'file',
    name: file.name,
    url: `blob:${id}`,
    size: file.size,
    mimeType: canonicalMimeType
  }

  useFileExplorerStore.getState().addItem(item)
  const storedItem = useFileExplorerStore.getState().items[id]
  try {
    if (!storedItem) throw new Error(`Failed to create file metadata: ${id}`)
    await db.put('folder-items', storedItem)
  } catch (error) {
    useFileExplorerStore.getState().removeItem(id)
    await deleteFileBlob(db, id).catch(() => undefined)
    throw error
  }
  return id
}

export function removeFileItemFromStore(id: string): void {
  useFileExplorerStore.getState().softDeleteItem(id)
}

export function removeCleanedEntriesFromStore(result: CleanupResult): void {
  const folderIds = new Set(result.folderIds)
  const itemIds = new Set(result.itemIds)
  useFileExplorerStore.setState((state) => {
    const folders = Object.fromEntries(
      Object.entries(state.folders).filter(([id]) => !folderIds.has(id))
    )
    const items = Object.fromEntries(Object.entries(state.items).filter(([id]) => !itemIds.has(id)))
    const childFoldersByParent: typeof state._childFoldersByParent = {}
    for (const folder of Object.values(folders)) {
      if (folder.parentId === null) continue
      const list = childFoldersByParent[folder.parentId] ?? []
      list.push(folder)
      childFoldersByParent[folder.parentId] = list
    }
    const itemsByParent: typeof state._itemsByParent = {}
    for (const [parentId, loadedItems] of Object.entries(state._itemsByParent)) {
      if (folderIds.has(parentId)) continue
      itemsByParent[parentId] = loadedItems.filter((item) => !itemIds.has(item.id))
    }
    return {
      folders,
      items,
      _foldersArray: Object.values(folders),
      _itemsArray: Object.values(items),
      _childFoldersByParent: childFoldersByParent,
      _itemsByParent: itemsByParent,
      loadedParents: new Set([...state.loadedParents].filter((id) => !folderIds.has(id))),
      currentFolderId: folderIds.has(state.currentFolderId)
        ? FILE_EXPLORER_ROOT_ID
        : state.currentFolderId
    }
  })
}

export async function permanentDeleteFileItemFromStore(id: string): Promise<void> {
  removeCleanedEntriesFromStore(await cleanupFileResources({ itemIds: [id] }))
}

export function deleteFolderFromStore(folderId: string): void {
  useFileExplorerStore.getState().softDeleteFolder(folderId)
}

export async function permanentDeleteFolderFromStore(folderId: string): Promise<void> {
  removeCleanedEntriesFromStore(await cleanupFileResources({ folderIds: [folderId] }))
}

export async function purgeExpiredTrashFromStore(retentionMs: number): Promise<void> {
  removeCleanedEntriesFromStore(await purgeExpiredFileTrash(retentionMs))
}
