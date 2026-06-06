import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UseBoundStore, StoreApi } from 'zustand'
import { deleteFileBlob, openFileExplorerDB, storeFileBlob } from '@renderer/lib/file-explorer-db'
import { deleteThumbnail, deletePdfPageThumbs } from '@renderer/lib/thumbnail-db'
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
  const item = useFileExplorerStore.getState().items[id]
  const blobId = item?.type === 'file' ? item.url.replace(/^blob:/, '') : id
  useFileExplorerStore.getState().removeItem(id)
  await Promise.all([deleteFileBlob(db, blobId), deleteThumbnail(id), deletePdfPageThumbs(id)])
}

export function deleteFolderFromStore(folderId: string): void {
  useFileExplorerStore.getState().softDeleteFolder(folderId)
}

export async function permanentDeleteFolderFromStore(folderId: string): Promise<void> {
  const state = useFileExplorerStore.getState()
  const db = await openFileExplorerDB()

  const blobIds: string[] = []
  const thumbnailIds: string[] = []
  const queue: string[] = [folderId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    for (const item of state._itemsByParent[currentId] ?? []) {
      if (item.type === 'file') {
        blobIds.push(item.url.replace(/^blob:/, ''))
        thumbnailIds.push(item.id)
      }
    }
    for (const folder of state._childFoldersByParent[currentId] ?? []) {
      queue.push(folder.id)
    }
  }

  await Promise.all(blobIds.map((id) => deleteFileBlob(db, id)))
  await Promise.all([
    ...thumbnailIds.map((id) => deleteThumbnail(id)),
    ...thumbnailIds.map((id) => deletePdfPageThumbs(id))
  ])

  state.deleteFolder(folderId)
}
