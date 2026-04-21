import { useMemo } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { useBibleFolderStore } from '@renderer/stores/folder'
import type { FolderStoreState } from '@renderer/stores/folder'
import type { FolderRecord, AnyItemRecord } from '@shared/types/folder'

type FolderStore = UseBoundStore<StoreApi<FolderStoreState>>

export function createFolderSelectors(useStore: FolderStore) {
  function useCurrentFolderId(): string {
    return useStore((s: FolderStoreState) => s.currentFolderId)
  }

  function useCurrentFolder(): FolderRecord | undefined {
    const currentFolderId = useStore((s: FolderStoreState) => s.currentFolderId)
    const folders = useStore((s: FolderStoreState) => s.folders)
    return folders[currentFolderId]
  }

  function useChildFolders(parentId: string): FolderRecord[] {
    const folders = useStore((s: FolderStoreState) => s.folders)
    return useMemo(
      () =>
        Object.values(folders)
          .filter((f) => f.parentId === parentId)
          .sort((a, b) => a.sortIndex - b.sortIndex),
      [folders, parentId]
    )
  }

  function useItems(parentId: string): AnyItemRecord[] {
    const items = useStore((s: FolderStoreState) => s.items)
    return useMemo(
      () =>
        Object.values(items)
          .filter((i) => i.parentId === parentId)
          .sort((a, b) => a.sortIndex - b.sortIndex),
      [items, parentId]
    )
  }

  function useFolderPath(folderId: string): FolderRecord[] {
    const folders = useStore((s: FolderStoreState) => s.folders)
    return useMemo(() => {
      const path: FolderRecord[] = []
      let current = folders[folderId]
      while (current) {
        path.unshift(current)
        if (current.parentId === null) break
        current = folders[current.parentId]
      }
      return path
    }, [folders, folderId])
  }

  function useIsItemsLoaded(parentId: string): boolean {
    const loadedParents = useStore((s: FolderStoreState) => s.loadedParents)
    return loadedParents.has(parentId)
  }

  function useFolderStoreLoading(): boolean {
    return useStore((s: FolderStoreState) => s.isLoading)
  }

  return {
    useCurrentFolderId,
    useCurrentFolder,
    useChildFolders,
    useItems,
    useFolderPath,
    useIsItemsLoaded,
    useFolderStoreLoading
  }
}

const bibleFolderSelectors = createFolderSelectors(useBibleFolderStore)

export const {
  useCurrentFolderId,
  useCurrentFolder,
  useChildFolders,
  useItems,
  useFolderPath,
  useIsItemsLoaded,
  useFolderStoreLoading
} = bibleFolderSelectors
