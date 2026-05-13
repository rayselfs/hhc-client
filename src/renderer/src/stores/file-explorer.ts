import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deleteFileBlob, openFileExplorerDB, storeFileBlob } from '@renderer/lib/file-explorer-db'
import { deleteThumbnail } from '@renderer/lib/thumbnail-db'
import { hhcPersistStorage, createPersistName } from '@renderer/lib/persist-storage'
import { createFolderStore } from '@renderer/stores/folder'
import type { FileExplorerViewMode, FileItemRecord } from '@shared/types/folder'

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

export const useFileExplorerStore = createFolderStore({
  rootId: 'file-root',
  rootName: 'Files',
  getDB: () => openFileExplorerDB()
})

export const useFileExplorerSettings = create<FileExplorerSettingsState>()(
  persist(
    (set) => ({
      viewMode: 'medium-icon',
      setViewMode: (viewMode) => set({ viewMode }),
      sortField: 'createdAt',
      sortDir: 'none',
      setSortField: (sortField) => set({ sortField }),
      setSortDir: (sortDir) => set({ sortDir }),
      setSortFieldAndDir: (sortField, sortDir) => set({ sortField, sortDir }),
      colWidths: { created: 112, size: 80, kind: 96 },
      setColWidths: (widths) =>
        set((state) => ({ colWidths: { ...state.colWidths, ...widths } }))
    }),
    {
      name: createPersistName('file-explorer-settings'),
      storage: hhcPersistStorage,
      version: 1,
      migrate: (state: any) => state,
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortField: state.sortField,
        sortDir: state.sortDir,
        colWidths: state.colWidths
      })
    }
  )
)

export const useFileExplorerSearch = create<FileExplorerSearchState>()((set) => ({
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery })
}))

export const useFavoritesExplorerSettings = create<FileExplorerSettingsState>()(
  persist(
    (set) => ({
      viewMode: 'medium-icon',
      setViewMode: (viewMode) => set({ viewMode }),
      sortField: 'name',
      sortDir: 'asc',
      setSortField: (sortField) => set({ sortField }),
      setSortDir: (sortDir) => set({ sortDir }),
      setSortFieldAndDir: (sortField, sortDir) => set({ sortField, sortDir }),
      colWidths: { created: 112, size: 80, kind: 96 },
      setColWidths: (widths) =>
        set((state) => ({ colWidths: { ...state.colWidths, ...widths } }))
    }),
    {
      name: createPersistName('favorites-explorer-settings'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortField: state.sortField,
        sortDir: state.sortDir,
        colWidths: state.colWidths
      })
    }
  )
)

export const useTrashExplorerSettings = create<FileExplorerSettingsState>()(
  persist(
    (set) => ({
      viewMode: 'medium-icon',
      setViewMode: (viewMode) => set({ viewMode }),
      sortField: 'createdAt',
      sortDir: 'desc',
      setSortField: (sortField) => set({ sortField }),
      setSortDir: (sortDir) => set({ sortDir }),
      setSortFieldAndDir: (sortField, sortDir) => set({ sortField, sortDir }),
      colWidths: { created: 112, size: 80, kind: 96 },
      setColWidths: (widths) =>
        set((state) => ({ colWidths: { ...state.colWidths, ...widths } }))
    }),
    {
      name: createPersistName('trash-explorer-settings'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortField: state.sortField,
        sortDir: state.sortDir,
        colWidths: state.colWidths
      })
    }
  )
)

export async function addFileItemToStore(file: File, parentId: string): Promise<string> {
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
    mimeType: file.type || 'application/octet-stream'
  }

  useFileExplorerStore.getState().addItem(item)
  return id
}

export function removeFileItemFromStore(id: string): void {
  useFileExplorerStore.getState().softDeleteItem(id)
}

export async function permanentDeleteFileItemFromStore(id: string): Promise<void> {
  const db = await openFileExplorerDB()
  useFileExplorerStore.getState().removeItem(id)
  await Promise.all([deleteFileBlob(db, id), deleteThumbnail(id)])
}

export function deleteFolderFromStore(folderId: string): void {
  useFileExplorerStore.getState().softDeleteFolder(folderId)
}

export async function permanentDeleteFolderFromStore(folderId: string): Promise<void> {
  const state = useFileExplorerStore.getState()
  const db = await openFileExplorerDB()

  const itemIds: string[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    for (const item of state._itemsArray) {
      if (item.parentId === currentId && item.type === 'file') {
        itemIds.push(item.id)
      }
    }
    for (const folder of state._foldersArray) {
      if (folder.parentId === currentId) {
        queue.push(folder.id)
      }
    }
  }

  await Promise.all(itemIds.flatMap((id) => [deleteFileBlob(db, id), deleteThumbnail(id)]))

  state.deleteFolder(folderId)
}
