import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  deleteFileBlob,
  openFileExplorerDB,
  storeFileBlob
} from '@renderer/lib/file-explorer-db'
import { hhcPersistStorage, createPersistName } from '@renderer/lib/persist-storage'
import { createFolderStore } from '@renderer/stores/folder'
import type { FileExplorerViewMode, FileItemRecord } from '@shared/types/folder'

interface FileExplorerSettingsState {
  viewMode: FileExplorerViewMode
  setViewMode: (mode: FileExplorerViewMode) => void
}

export const useFileExplorerStore = createFolderStore({
  rootId: 'file-root',
  rootName: 'Files',
  getDB: () => openFileExplorerDB() as Promise<unknown>
})

export const useFileExplorerSettings = create<FileExplorerSettingsState>()(
  persist(
    (set) => ({
      viewMode: 'medium-icon',
      setViewMode: (viewMode) => set({ viewMode })
    }),
    {
      name: createPersistName('file-explorer-settings'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        viewMode: state.viewMode
      })
    }
  )
)

export async function addFileItemToStore(file: File, parentId: string): Promise<void> {
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

  const addItem = useFileExplorerStore.getState().addItem as (fileItem: typeof item) => void
  addItem(item)
}

export async function removeFileItemFromStore(id: string): Promise<void> {
  const db = await openFileExplorerDB()

  useFileExplorerStore.getState().removeItem(id)
  await deleteFileBlob(db, id)
}
