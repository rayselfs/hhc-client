import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useDebounceFn } from '@vueuse/core'
import type { Folder, FolderItem, StorageCategory } from '@/types/common'
import { getStorageKey } from '@/types/common'
import { useFolderManager } from '@/composables/useFolderManager'
import { useLocalStorage } from '@/composables/useLocalStorage'

/**
 * Configuration for folder store
 */
export interface FolderStoreConfig {
  rootId: string
  defaultRootName: string
  storageCategory: StorageCategory
  storageKey: string
}

/**
 * Generic folder store for managing folder tree structure
 * This store is designed to be reusable for different item types (verses, media files, etc.)
 */
export const useFolderStore = <TItem extends FolderItem = FolderItem>(
  config: FolderStoreConfig,
) => {
  return defineStore(`folder-${config.rootId}`, () => {
    /**
     * Root folder containing all top-level folders and root-level items
     * This is the single source of truth for the folder tree structure
     */
    const rootFolder = ref<Folder<TItem>>({
      id: config.rootId,
      name: config.defaultRootName,
      expanded: false,
      items: [],
      folders: [],
      timestamp: Date.now(),
    })

    /**
     * Current folder navigation path
     * Array of folder IDs representing the current location in the folder tree
     * [rootId] means at root level
     */
    const currentFolderPath = ref<string[]>([config.rootId])

    /**
     * Folder manager for read-only operations
     * Used for querying folder tree structure
     */
    const folderManager = useFolderManager(rootFolder, currentFolderPath, {
      rootId: config.rootId,
    })
    const {
      currentFolder,
      getFolderById,
      deleteFolderRecursive,
      updateFolderInTree,
      isFolderInside,
      getMoveTargets,
    } = folderManager

    const { getLocalItem, setLocalItem } = useLocalStorage()

    /**
     * Load root folder from LocalStorage
     */
    const loadRootFolder = () => {
      const saved = getLocalItem<Folder<TItem>>(
        getStorageKey(config.storageCategory, config.storageKey),
        'object',
      )

      if (saved && saved.id === config.rootId) {
        rootFolder.value = saved
        // Check for expired folders after loading
        if (checkExpiredFolders(rootFolder.value.folders as Folder<TItem>[])) {
          saveRootFolder() // Save immediately if items were removed
        }
      }
    }

    /**
     * Save root folder to LocalStorage
     * Debounced to prevent frequent writes
     */
    const saveRootFolder = useDebounceFn(() => {
      setLocalItem(
        getStorageKey(config.storageCategory, config.storageKey),
        rootFolder.value,
        'object',
      )
    }, 1000)

    // Watch rootFolder changes and auto-save to LocalStorage
    watch(
      rootFolder,
      () => {
        saveRootFolder()
      },
      { deep: true },
    )

    /**
     * Check and remove expired folders recursively
     * @param folders - List of folders to check
     * @returns true if any folder was removed
     */
    const checkExpiredFolders = (folders: Folder<TItem>[]): boolean => {
      let changed = false
      const now = Date.now()

      // Filter out expired folders
      const initialLength = folders.length
      const validFolders = folders.filter((folder) => {
        if (folder.expiresAt && folder.expiresAt < now) {
          return false // Remove expired folder
        }
        return true
      })

      if (validFolders.length !== initialLength) {
        folders.length = 0
        folders.push(...validFolders)
        changed = true
      }

      // Recursively check subfolders
      folders.forEach((folder) => {
        if (checkExpiredFolders(folder.folders)) {
          changed = true
        }
      })

      return changed
    }

    /**
     * Navigate to root
     */
    const navigateToRoot = () => {
      currentFolderPath.value = [config.rootId]
    }

    /**
     * Navigate to a specific folder by ID
     * If the folder ID is already in the path, navigates to that position
     * Otherwise, navigates to the end of current path
     * @param folderId - The folder ID to navigate to
     */
    const navigateToFolder = (folderId: string) => {
      const index = currentFolderPath.value.indexOf(folderId)
      if (index !== -1) {
        // Navigate to existing position in path
        currentFolderPath.value = currentFolderPath.value.slice(0, index + 1)
      } else {
        // Add to end of path
        currentFolderPath.value = [...currentFolderPath.value, folderId]
      }
    }

    /**
     * Enter a folder (add to navigation path)
     * @param folderId - The folder ID to enter
     */
    const enterFolder = (folderId: string) => {
      currentFolderPath.value = [...currentFolderPath.value, folderId]
    }

    /**
     * Add a new folder to the current folder
     * @param name - The name of the new folder
     * @param expiresAt - Optional timestamp when the folder should expire
     */
    const addFolderToCurrent = (name: string, expiresAt?: number | null) => {
      if (!name.trim()) return

      const newFolder: Folder<TItem> = {
        id: uuidv4(),
        name: name.trim(),
        expanded: false,
        items: [] as TItem[],
        folders: [] as Folder<TItem>[],
        parentId: currentFolder.value?.id,
        timestamp: Date.now(),
        expiresAt: expiresAt || null,
      }

      // Direct mutation - Vue reactivity will handle the update
      // @ts-expect-error - Vue's ref type system, runtime safe
      currentFolder.value.folders.push(newFolder)
    }

    /**
     * Add an item to the current folder
     * Pure push operation without any duplicate checking
     * Business logic (duplicate checks) should be handled by the calling store
     * @param item - The item to add
     */
    const addItemToCurrent = (item: TItem): void => {
      // Direct mutation - no checking, pure push
      // @ts-expect-error - Vue's ref type system, runtime safe
      currentFolder.value.items.push(item)
    }

    /**
     * Remove an item from the current folder
     * @param itemId - The ID of the item to remove
     */
    const removeItemFromCurrent = (itemId: string) => {
      // Direct mutation
      currentFolder.value.items = currentFolder.value.items.filter((item) => item.id !== itemId)
    }

    /**
     * Delete a folder and all its subfolders
     * @param folderId - The ID of the folder to delete
     */
    const deleteFolder = (folderId: string) => {
      // Direct mutation using helper from folderManager
      deleteFolderRecursive(rootFolder.value.folders, folderId)
    }

    /**
     * Move an item from source to target folder
     * @param item - The item to move
     * @param targetFolderId - The target folder ID (use rootId for root)
     * @param sourceFolderId - The source folder ID (use rootId for root)
     */
    const moveItem = (item: TItem, targetFolderId: string, sourceFolderId: string) => {
      // Remove from source - direct mutation
      if (sourceFolderId === config.rootId) {
        rootFolder.value.items = rootFolder.value.items.filter((i) => i.id !== item.id)
      } else {
        updateFolderInTree(rootFolder.value.folders, sourceFolderId, (folder) => {
          folder.items = folder.items.filter((i) => i.id !== item.id)
        })
      }

      // Add to target - direct mutation
      if (targetFolderId === config.rootId) {
        // @ts-expect-error - Vue's ref type system, runtime safe
        rootFolder.value.items.push(item)
      } else {
        updateFolderInTree(rootFolder.value.folders, targetFolderId, (folder) => {
          // @ts-expect-error - Vue's ref type system, runtime safe
          folder.items.push(item)
        })
      }
    }

    /**
     * Move a folder from source to target
     * @param folderToMove - The folder to move
     * @param targetFolderId - The target folder ID (use rootId for root level)
     * @param sourceFolderId - The source folder ID (use rootId for root level)
     * @returns true if successful, false if invalid move
     */
    const moveFolder = (
      folderToMove: Folder<TItem>,
      targetFolderId: string,
      sourceFolderId: string,
    ): boolean => {
      const targetFolder =
        targetFolderId === config.rootId ? rootFolder.value : getFolderById(targetFolderId)

      if (!targetFolder) return false

      // Prevent moving folder into itself or its children
      // @ts-expect-error - Vue's ref type system, runtime safe
      if (isFolderInside(folderToMove, targetFolder)) {
        return false
      }

      // Remove from source - direct mutation
      if (sourceFolderId === config.rootId) {
        rootFolder.value.folders = rootFolder.value.folders.filter((f) => f.id !== folderToMove.id)
      } else {
        updateFolderInTree(rootFolder.value.folders, sourceFolderId, (folder) => {
          folder.folders = folder.folders.filter((f) => f.id !== folderToMove.id)
        })
      }

      // Add to target - direct mutation
      if (targetFolderId === config.rootId) {
        folderToMove.parentId = config.rootId
        // @ts-expect-error - Vue's ref type system, runtime safe
        rootFolder.value.folders.push(folderToMove)
      } else {
        updateFolderInTree(rootFolder.value.folders, targetFolderId, (folder) => {
          folderToMove.parentId = targetFolder.id
          // @ts-expect-error - Vue's ref type system, runtime safe
          folder.folders.push(folderToMove)
        })
      }

      return true
    }

    /**
     * Deep clone a folder and all its contents, generating new IDs
     * @param folder - The folder to clone
     * @param parentId - The ID of the parent folder for the new clone
     */
    const deepCloneFolder = (folder: Folder<TItem>, parentId: string): Folder<TItem> => {
      const newFolderId = uuidv4()

      // Deep clone items with new IDs
      const newItems = folder.items.map((item) => ({
        ...item,
        id: uuidv4(),
        // Update timestamp if it exists (common for items)
        ...('timestamp' in item ? { timestamp: Date.now() } : {}),
      }))

      // Recursively deep clone sub-folders
      const newSubFolders = folder.folders.map((subFolder) =>
        deepCloneFolder(subFolder, newFolderId),
      )

      return {
        ...folder,
        id: newFolderId,
        parentId: parentId,
        items: newItems,
        folders: newSubFolders,
        expanded: false, // Collapse pasted folders by default
        timestamp: Date.now(), // Update timestamp for the clone
      }
    }

    /**
     * Paste an item (verse or folder) to a target folder
     * Creates a copy with new ID
     * @param item - The item to paste (can be TItem or Folder)
     * @param targetFolderId - The target folder ID (use rootId for root)
     * @param itemType - The type of item ('verse' or 'folder')
     */
    const pasteItem = (
      item: TItem | Folder<TItem>,
      targetFolderId: string,
      itemType: 'verse' | 'folder',
    ) => {
      if (itemType === 'verse') {
        const verseItem = item as TItem
        const newItem: TItem = {
          ...verseItem,
          id: uuidv4(),
          timestamp: Date.now(),
        }

        if (targetFolderId === config.rootId) {
          // @ts-expect-error - Vue's ref type system, runtime safe
          rootFolder.value.items.push(newItem)
        } else {
          updateFolderInTree(rootFolder.value.folders, targetFolderId, (folder) => {
            // @ts-expect-error - Vue's ref type system, runtime safe
            folder.items.push(newItem)
          })
        }
      } else {
        const folder = item as Folder<TItem>
        // Use deep clone to prevent shared references
        const newFolder = deepCloneFolder(folder, targetFolderId)

        if (targetFolderId === config.rootId) {
          // @ts-expect-error - Vue's ref type system, runtime safe
          rootFolder.value.folders.push(newFolder)
        } else {
          updateFolderInTree(rootFolder.value.folders, targetFolderId, (target) => {
            // @ts-expect-error - Vue's ref type system, runtime safe
            target.folders.push(newFolder)
          })
        }
      }
    }

    return {
      // Folder State
      rootFolder,
      currentFolderPath,
      // Folder Management
      loadRootFolder,
      saveRootFolder,
      // Folder Navigation
      navigateToRoot,
      navigateToFolder,
      enterFolder,
      // Folder Operations (read-only computed)
      currentFolder,
      getCurrentFolders: folderManager.getCurrentFolders,
      getCurrentItems: folderManager.getCurrentItems,
      getFolderById,
      getMoveTargets,
      isFolderInside,
      // Folder Operations (write actions)
      addFolderToCurrent,
      addItemToCurrent,
      removeItemFromCurrent,
      deleteFolder,
      moveItem,
      moveFolder,
      pasteItem,
    }
  })()
}
