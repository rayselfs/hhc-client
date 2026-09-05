import { useCallback } from 'react'
import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { deleteFileBlob, openFileExplorerDB, storeFileBlob } from '@renderer/lib/file-explorer-db'
import { hhcPersistStorage, createPersistName } from '@renderer/lib/persist-storage'
import { createFolderStore } from '@renderer/stores/folder'
import type { FileExplorerViewMode, FileItemRecord, FolderRecord } from '@shared/types/folder'
import {
  cleanupFileResources,
  purgeExpiredFileTrash,
  type CleanupResult
} from '@renderer/lib/file-resource-cleanup'

export type SortField = 'name' | 'createdAt' | 'size' | 'kind'
export type SortDir = 'asc' | 'desc' | 'none'
export type GroupMode = 'none' | 'date'
export interface FolderDisplayPreference {
  sortField: SortField
  sortDir: SortDir
  groupMode: GroupMode
}

interface FileExplorerSettingsState {
  folderDisplay: Record<string, Partial<FolderDisplayPreference>>
  setFolderDisplay: (folderId: string, preference: Partial<FolderDisplayPreference>) => void
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

type FileExplorerSettingsStore = UseBoundStore<
  Mutate<StoreApi<FileExplorerSettingsState>, [['zustand/persist', unknown]]>
>

const CREATED_COLUMN_WIDTH = 160
const EXPLORER_SETTINGS_VERSION = 3

function migrateExplorerSettings(state: unknown): unknown {
  if (!state || typeof state !== 'object') return state
  const persisted = state as { colWidths?: { created?: number; size?: number; kind?: number } }
  if (persisted.colWidths?.created !== 112) return state
  return {
    ...persisted,
    colWidths: { ...persisted.colWidths, created: CREATED_COLUMN_WIDTH }
  }
}

export const FILE_EXPLORER_ROOT_ID = 'file-root'

export const useFileExplorerStore = createFolderStore({
  rootId: FILE_EXPLORER_ROOT_ID,
  rootName: 'Files',
  getDB: () => openFileExplorerDB()
})

export function publishPersistedFileItem(item: FileItemRecord): void {
  useFileExplorerStore.setState((state) => {
    const items = { ...state.items, [item.id]: item }
    const siblings = [
      ...(state._itemsByParent[item.parentId] ?? []).filter((entry) => entry.id !== item.id),
      item
    ].sort((a, b) => a.sortIndex - b.sortIndex)
    return {
      items,
      _itemsArray: Object.values(items),
      _itemsByParent: {
        ...state._itemsByParent,
        [item.parentId]: siblings
      }
    }
  })
}

function createExplorerSettingsStore(
  persistName: string,
  defaults: { sortField: SortField; sortDir: SortDir },
  options: { version?: number; migrate?: (state: unknown) => unknown } = {}
): FileExplorerSettingsStore {
  return create<FileExplorerSettingsState>()(
    persist(
      (set) => ({
        folderDisplay: {},
        setFolderDisplay: (folderId, preference) =>
          set((state) => ({
            folderDisplay: {
              ...state.folderDisplay,
              [folderId]: { ...state.folderDisplay[folderId], ...preference }
            }
          })),
        viewMode: 'medium-icon',
        setViewMode: (viewMode) => set({ viewMode }),
        sortField: defaults.sortField,
        sortDir: defaults.sortDir,
        setSortField: (sortField) => set({ sortField }),
        setSortDir: (sortDir) => set({ sortDir }),
        setSortFieldAndDir: (sortField, sortDir) => set({ sortField, sortDir }),
        colWidths: { created: CREATED_COLUMN_WIDTH, size: 80, kind: 96 },
        setColWidths: (widths) => set((state) => ({ colWidths: { ...state.colWidths, ...widths } }))
      }),
      {
        name: createPersistName(persistName),
        storage: hhcPersistStorage,
        version: options.version ?? 0,
        ...(options.migrate ? { migrate: options.migrate } : {}),
        partialize: (state) => ({
          folderDisplay: state.folderDisplay,
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
  { version: EXPLORER_SETTINGS_VERSION, migrate: migrateExplorerSettings }
)

export const useFileExplorerSearch = create<FileExplorerSearchState>()((set) => ({
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery })
}))

export const useFavoritesExplorerSettings = createExplorerSettingsStore(
  'favorites-explorer-settings',
  { sortField: 'name', sortDir: 'asc' },
  { version: EXPLORER_SETTINGS_VERSION, migrate: migrateExplorerSettings }
)

export const useTrashExplorerSettings = createExplorerSettingsStore(
  'trash-explorer-settings',
  {
    sortField: 'createdAt',
    sortDir: 'desc'
  },
  { version: EXPLORER_SETTINGS_VERSION, migrate: migrateExplorerSettings }
)

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

export function resolveFolderDisplay(
  folderId: string,
  folders: Record<string, FolderRecord>,
  defaults: Pick<FolderDisplayPreference, 'sortField' | 'sortDir'>,
  override?: Partial<FolderDisplayPreference>
): FolderDisplayPreference {
  let folder = folders[folderId]
  const visited = new Set<string>()
  let isLine = false
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id)
    if (folder.syncLink) {
      isLine = folder.syncLink.providerType === 'hhc-line'
      break
    }
    if (!folder.parentId) break
    folder = folders[folder.parentId]
  }
  return {
    ...defaults,
    groupMode: 'none',
    ...(isLine
      ? { sortField: 'createdAt' as const, sortDir: 'desc' as const, groupMode: 'date' as const }
      : {}),
    ...override
  }
}

export function useCurrentFolderDisplay(): FolderDisplayPreference & {
  setSortFieldAndDir: (field: SortField, dir: SortDir) => void
  setSortDir: (dir: SortDir) => void
  setGroupMode: (mode: GroupMode) => void
} {
  const folderId = useFileExplorerStore((state) => state.currentFolderId)
  const folders = useFileExplorerStore((state) => state.folders)
  const sortField = useFileExplorerSettings((state) => state.sortField)
  const sortDir = useFileExplorerSettings((state) => state.sortDir)
  const override = useFileExplorerSettings((state) => state.folderDisplay[folderId])
  const setDisplay = useFileExplorerSettings((state) => state.setFolderDisplay)
  const setSortFieldAndDir = useCallback(
    (field: SortField, dir: SortDir) => setDisplay(folderId, { sortField: field, sortDir: dir }),
    [folderId, setDisplay]
  )
  const setSortDir = useCallback(
    (dir: SortDir) => setDisplay(folderId, { sortDir: dir }),
    [folderId, setDisplay]
  )
  const setGroupMode = useCallback(
    (mode: GroupMode) => setDisplay(folderId, { groupMode: mode }),
    [folderId, setDisplay]
  )
  return {
    ...resolveFolderDisplay(folderId, folders, { sortField, sortDir }, override),
    setSortFieldAndDir,
    setSortDir,
    setGroupMode
  }
}
