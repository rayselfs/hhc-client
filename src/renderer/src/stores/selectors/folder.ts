import { useMemo } from 'react'
import { useBibleFolderStore } from '@renderer/stores/folder'
import type { FolderRecord, AnyItemRecord } from '@shared/types/folder'

export function useCurrentFolderId(): string {
  return useBibleFolderStore((s) => s.currentFolderId)
}

export function useCurrentFolder(): FolderRecord | undefined {
  const currentFolderId = useBibleFolderStore((s) => s.currentFolderId)
  const folders = useBibleFolderStore((s) => s.folders)
  return folders[currentFolderId]
}

export function useChildFolders(parentId: string): FolderRecord[] {
  const folders = useBibleFolderStore((s) => s.folders)
  return useMemo(
    () =>
      Object.values(folders)
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.sortIndex - b.sortIndex),
    [folders, parentId]
  )
}

export function useItems(parentId: string): AnyItemRecord[] {
  const items = useBibleFolderStore((s) => s.items)
  return useMemo(
    () =>
      Object.values(items)
        .filter((i) => i.parentId === parentId)
        .sort((a, b) => a.sortIndex - b.sortIndex),
    [items, parentId]
  )
}

export function useFolderPath(folderId: string): FolderRecord[] {
  const folders = useBibleFolderStore((s) => s.folders)
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

export function useIsItemsLoaded(parentId: string): boolean {
  const loadedParents = useBibleFolderStore((s) => s.loadedParents)
  return loadedParents.has(parentId)
}

export function useFolderStoreLoading(): boolean {
  return useBibleFolderStore((s) => s.isLoading)
}
