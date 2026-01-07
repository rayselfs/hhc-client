/**
 * Composable for managing folder tree operations
 * Provides all folder-related utilities including finding, updating, deleting, and navigating folders
 */
import { type Ref, computed } from 'vue'
import type { Folder, FolderItem } from '@/types/common'

/**
 * Options for folder manager configuration
 */
export interface FolderManagerOptions<TItem extends FolderItem = FolderItem> {
  rootId: string // Root folder ID
  maxDepth?: number // Maximum folder depth (optional)
  folderMap?: Map<string, Folder<TItem>> // Optional flat index map
  itemMap?: Map<string, TItem> // Optional flat index map
}

/**
 * Folder manager composable
 * @template TItem - The type of items in folders (must extend FolderItem)
 * @param rootFolderRef - Reactive reference to the root folder (can be Ref or computed with getter/setter)
 * @param currentFolderPathRef - Reactive reference to the current folder path (array of folder IDs)
 * @param options - Configuration options including rootId
 */
export function useFolderManager<TItem extends FolderItem = FolderItem>(
  rootFolderRef: Ref<Folder<TItem>> | { value: Folder<TItem> },
  currentFolderPathRef: Ref<string[]> | { value: string[] },
  options: FolderManagerOptions<TItem>,
) {
  /**
   * Find a folder by ID in the folder tree
   * @param folderId - The folder ID to find
   * @returns The folder if found, null otherwise
   */
  const getFolderById = (folderId: string): Folder<TItem> | null => {
    // Optimization: Use flat index if available
    if (options.folderMap && options.folderMap.has(folderId)) {
      return options.folderMap.get(folderId) || null
    }

    const root = rootFolderRef.value
    if (root.id === folderId) return root

    return findFolderInTree(root, folderId)
  }

  /**
   * Recursively find a folder in the tree
   * @param folder - The folder to search in
   * @param folderId - The folder ID to find
   * @returns The folder if found, null otherwise
   */
  const findFolderInTree = (folder: Folder<TItem>, folderId: string): Folder<TItem> | null => {
    for (const subFolder of folder.folders) {
      if (subFolder.id === folderId) return subFolder
      const found = findFolderInTree(subFolder, folderId)
      if (found) return found
    }
    return null
  }

  /**
   * Get the current folder based on the current folder path
   * Returns root folder if at root level
   */
  const currentFolder = computed<Folder<TItem>>(() => {
    if (
      currentFolderPathRef.value.length === 0 ||
      currentFolderPathRef.value[0] !== options.rootId
    ) {
      // Default to root if path is invalid
      return rootFolderRef.value
    }

    const currentFolderId = currentFolderPathRef.value[currentFolderPathRef.value.length - 1]
    if (!currentFolderId || currentFolderId === options.rootId) {
      return rootFolderRef.value
    }

    const folder = getFolderById(currentFolderId)
    return folder ?? rootFolderRef.value
  })

  /**
   * Get folders visible in the current view
   * Returns subfolders if inside a folder, or all folders if at root
   */
  const getCurrentFolders = computed((): Folder<TItem>[] => {
    const folder = currentFolder.value
    return folder.folders
  })

  /**
   * Get items visible in the current view
   * Returns folder items (root.items when at root, or folder.items when inside a folder)
   */
  const getCurrentItems = computed((): TItem[] => {
    const folder = currentFolder.value
    return folder.items
  })

  /**
   * Update a folder in the tree
   * @param folders - The folder array to update (can be root or a folder's subfolders)
   * @param folderId - The ID of the folder to update
   * @param updater - Function to update the folder
   * @returns true if folder was found and updated, false otherwise
   */
  const updateFolderInTree = (
    folders: Folder<TItem>[],
    folderId: string,
    updater: (folder: Folder<TItem>) => void,
  ): boolean => {
    for (const folder of folders) {
      if (folder.id === folderId) {
        updater(folder)
        return true
      }
      if (updateFolderInTree(folder.folders, folderId, updater)) {
        return true
      }
    }
    return false
  }

  /**
   * Recursively delete a folder and all its subfolders
   * @param folders - The folder array to delete from
   * @param id - The ID of the folder to delete
   * @returns true if folder was found and deleted, false otherwise
   */
  const deleteFolderRecursive = (folders: Folder<TItem>[], id: string): boolean => {
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i]
      if (folder && folder.id === id) {
        folders.splice(i, 1)
        return true
      }
      if (folder && folder.folders && deleteFolderRecursive(folder.folders, id)) {
        return true
      }
    }
    return false
  }

  /**
   * Check if a folder is inside another folder (or is the same folder)
   * @param folderToMove - The folder to check
   * @param targetFolder - The target folder to check against
   * @returns true if folderToMove is inside targetFolder, false otherwise
   */
  const isFolderInside = (folderToMove: Folder<TItem>, targetFolder: Folder<TItem>): boolean => {
    if (folderToMove.id === targetFolder.id) return true

    for (const subFolder of targetFolder.folders) {
      if (isFolderInside(folderToMove, subFolder)) {
        return true
      }
    }

    return false
  }

  /**
   * Get available folders for moving (excluding the folder being moved and its children)
   * @param contextFolder - The folder to get targets from (if null, uses currentFolder)
   * @param excludeFolderId - The folder ID to exclude (optional)
   * @returns Array of available folders
   */
  const getMoveTargets = (
    contextFolder: Folder<TItem> | null = null,
    excludeFolderId?: string,
  ): Folder<TItem>[] => {
    const sourceFolder = contextFolder ?? currentFolder.value
    let folders: Folder<TItem>[] = []

    folders = sourceFolder.folders.filter((folder) => {
      if (excludeFolderId && folder.id === excludeFolderId) return false
      if (excludeFolderId) {
        const folderToExclude = getFolderById(excludeFolderId)
        return folderToExclude ? !isFolderInside(folderToExclude, folder) : true
      }
      return true
    })

    return folders
  }

  return {
    // Computed properties
    currentFolder,
    getCurrentFolders,
    getCurrentItems,

    // Read-only folder operations
    getFolderById,
    findFolderInTree,
    isFolderInside,
    getMoveTargets,

    // Internal helper functions (used by store, not exposed to components)
    updateFolderInTree,
    deleteFolderRecursive,
  }
}
