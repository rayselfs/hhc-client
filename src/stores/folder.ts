/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import {
  type Folder,
  type FolderItem,
  type ClipboardItem,
  type FolderStoreConfig,
} from '@/types/common'
import { useFolderManager } from '@/composables/useFolderManager'
import { fileSystemProviderFactory } from '@/services/filesystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { FolderDBStore, MediaFolder } from '@/types/enum'
import { BibleFolder } from '@/types/enum'
import { StorageCategory } from '@/types/common'
import type { VerseItem, FileItem } from '@/types/common'

/**
 * Generic folder store for managing folder tree structure
 */
export const useFolderStore = <TItem extends FolderItem = FolderItem>(
  config: FolderStoreConfig,
) => {
  return defineStore(`folder-${config.rootId}`, () => {
    const rootFolder = ref<Folder<TItem>>({
      id: config.rootId,
      name: config.defaultRootName,
      expanded: false,
      items: [],
      folders: [],
      timestamp: Date.now(),
      sourceType: 'local',
    })

    const currentFolderPath = ref<string[]>([config.rootId])
    const clipboard = ref<ClipboardItem<TItem>[]>([])
    const viewMode = useLocalStorage<'large' | 'medium' | 'small'>(
      `hhc-view-mode-${config.rootId}`,
      'medium',
    )

    const folderMap = new Map<string, Folder<TItem>>()
    const itemMap = new Map<string, TItem>()

    const rebuildIndex = () => {
      folderMap.clear()
      itemMap.clear()
      const traverse = (folder: Folder<TItem>) => {
        folderMap.set(folder.id, folder)
        folder.items.forEach((item) => itemMap.set(item.id, item))
        folder.folders.forEach((sub) => traverse(sub))
      }
      traverse(rootFolder.value as any)
    }

    const folderManager = useFolderManager(rootFolder, currentFolderPath, {
      rootId: config.rootId,
      folderMap: folderMap as any,
      itemMap: itemMap as any,
    })

    const {
      currentFolder,
      getFolderById,
      deleteFolderRecursive: _deleteFolderRecursive,
      updateFolderInTree,
      isFolderInside,
      getMoveTargets,
    } = folderManager

    const db = useIndexedDB(FOLDER_DB_CONFIG)
    const storeName = FolderDBStore.FOLDER_DB_STRUCTURE_STORE_NAME

    const deleteFolderRecursive = async (folders: Folder<TItem>[], folderId: string) => {
      const folderToRemove = folderMap.get(folderId)
      if (folderToRemove) {
        const collectItemIds = (f: Folder<TItem>, ids: string[]) => {
          f.items.forEach((item) => ids.push(item.id))
          f.folders.forEach((sub) => collectItemIds(sub, ids))
        }
        const itemIds: string[] = []
        collectItemIds(folderToRemove, itemIds)

        for (const itemId of itemIds) {
          const item = itemMap.get(itemId)
          if ((item as any)?.metadata?.thumbnailBlobId) {
            await db.delete(
              FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
              (item as any).metadata.thumbnailBlobId,
            )
          }
        }
      }
      _deleteFolderRecursive(folders as any, folderId)
    }

    /**
     * Recursively checks for and deletes expired content
     * Returns true if any content was deleted (store structure changed)
     */
    // purgeExpiredContent removed, logic moved to useFileCleanup
    // The previous implementation was here (around line 104-199)

    const saveRootFolder = useDebounceFn(async () => {
      try {
        // Use requestIdleCallback to avoid blocking main thread during serialization
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(
            async () => {
              try {
                // Deep clone using JSON (compatible with all data types)
                const clonedData = JSON.parse(JSON.stringify(rootFolder.value))
                await db.put(storeName, clonedData)
              } catch (error) {
                console.error('Failed to save root folder to IndexedDB:', error)
              }
            },
            { timeout: 2000 },
          )
        } else {
          // Fallback for environments without requestIdleCallback
          const clonedData = JSON.parse(JSON.stringify(rootFolder.value))
          await db.put(storeName, clonedData)
        }
      } catch (error) {
        console.error('Failed to save root folder to IndexedDB:', error)
      }
    }, 1000)

    const loadRootFolder = async () => {
      try {
        const savedFolder = await db.get<Folder<TItem>>(storeName, config.rootId)
        if (savedFolder && savedFolder.id === config.rootId) {
          rootFolder.value = savedFolder as any
          rebuildIndex()
        } else {
          rebuildIndex()
        }
      } catch (error) {
        console.error('Failed to load root folder from IndexedDB:', error)
      }
    }

    // Removed deep watch for performance - now manually trigger saveRootFolder() in mutation functions
    // watch(rootFolder, () => saveRootFolder(), { deep: true })

    const copyToClipboard = (items: ClipboardItem<TItem>[]) => {
      clipboard.value = items
    }
    const cutToClipboard = (items: ClipboardItem<TItem>[]) => {
      clipboard.value = items
    }
    const clearClipboard = () => {
      clipboard.value = []
    }
    const navigateToRoot = () => {
      currentFolderPath.value = [config.rootId]
    }
    const enterFolder = (folderId: string) => {
      currentFolderPath.value = [...currentFolderPath.value, folderId]
    }

    const navigateToFolder = (folderId: string) => {
      const index = currentFolderPath.value.indexOf(folderId)
      if (index !== -1) {
        currentFolderPath.value = currentFolderPath.value.slice(0, index + 1)
      } else {
        currentFolderPath.value = [...currentFolderPath.value, folderId]
      }
    }

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
        sourceType: 'local',
        isLoaded: true,
      }
      currentFolder.value.folders.push(newFolder as any)
      folderMap.set(newFolder.id, newFolder)
      saveRootFolder()
    }

    const addItemToCurrent = (item: TItem): void => {
      currentFolder.value.items.push(item as any)
      itemMap.set(item.id, item)
      saveRootFolder()
    }

    const removeItemFromCurrent = async (itemId: string) => {
      const item = itemMap.get(itemId)
      if ((item as any)?.metadata?.thumbnailBlobId) {
        await db.delete(
          FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
          (item as any).metadata.thumbnailBlobId,
        )
      }
      currentFolder.value.items = currentFolder.value.items.filter((item) => item.id !== itemId)
      itemMap.delete(itemId)
      saveRootFolder()
    }

    const addItemToFolder = (folderId: string, item: TItem) => {
      if (folderId === config.rootId) {
        rootFolder.value.items.push(item as any)
        itemMap.set(item.id, item)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, folderId, (folder) => {
          folder.items.push(item as any)
          itemMap.set(item.id, item)
        })
      }
      saveRootFolder()
    }

    const deleteFolder = async (folderId: string) => {
      await deleteFolderRecursive(rootFolder.value.folders as any, folderId)
      rebuildIndex()
      saveRootFolder()
    }

    const updateFolder = (
      folderId: string,
      updates: { name?: string; expiresAt?: number | null },
    ) => {
      updateFolderInTree(rootFolder.value.folders as any, folderId, (folder) => {
        if (updates.name !== undefined) folder.name = updates.name.trim()
        if (updates.expiresAt !== undefined) folder.expiresAt = updates.expiresAt
        folder.timestamp = Date.now()
      })
      saveRootFolder()
    }

    const reorderCurrentItems = (orderedItems: TItem[]) => {
      currentFolder.value.items = [...orderedItems] as any
      saveRootFolder()
    }
    const reorderCurrentFolders = (orderedFolders: Folder<TItem>[]) => {
      currentFolder.value.folders = [...orderedFolders] as any
      saveRootFolder()
    }

    const updateItem = (itemId: string, folderId: string, updates: Partial<TItem>) => {
      if (folderId === config.rootId) {
        const item = rootFolder.value.items.find((i) => i.id === itemId)
        if (item) Object.assign(item, updates)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, folderId, (folder) => {
          const item = folder.items.find((i) => (i as any).id === itemId)
          if (item) Object.assign(item, updates)
        })
      }
      saveRootFolder()
    }

    const moveItem = (item: TItem, targetFolderId: string, sourceFolderId: string) => {
      // Use folderMap for O(1) lookup instead of recursive search
      const sourceFolder =
        sourceFolderId === config.rootId ? rootFolder.value : folderMap.get(sourceFolderId)
      const targetFolder =
        targetFolderId === config.rootId ? rootFolder.value : folderMap.get(targetFolderId)

      if (!sourceFolder || !targetFolder) {
        console.error('moveItem: source or target folder not found')
        return
      }

      // Remove item from source folder
      sourceFolder.items = sourceFolder.items.filter((i) => i.id !== item.id) as any

      // Add item to target folder
      targetFolder.items.push(item as any)

      saveRootFolder()
    }

    const moveFolder = (
      folderToMove: Folder<TItem>,
      targetFolderId: string,
      sourceFolderId: string,
      skipSave = false,
    ): boolean => {
      // Use folderMap for O(1) lookup instead of recursive search
      const targetFolder =
        targetFolderId === config.rootId ? rootFolder.value : folderMap.get(targetFolderId)
      const sourceFolder =
        sourceFolderId === config.rootId ? rootFolder.value : folderMap.get(sourceFolderId)

      if (!targetFolder || !sourceFolder) {
        console.error('moveFolder: source or target folder not found')
        return false
      }

      if (isFolderInside(folderToMove as any, targetFolder as any)) return false

      // Remove folder from source
      sourceFolder.folders = sourceFolder.folders.filter((f) => f.id !== folderToMove.id) as any

      // Update parent ID and add to target
      folderToMove.parentId = targetFolder.id
      targetFolder.folders.push(folderToMove as any)

      if (!skipSave) {
        saveRootFolder()
      }
      return true
    }

    const deepCloneFolder = (folder: Folder<TItem>, parentId: string): Folder<TItem> => {
      const newFolderId = uuidv4()
      const newItems = folder.items.map((item) => ({
        ...item,
        id: uuidv4(),
        timestamp: Date.now(),
      }))
      const newSubFolders = folder.folders.map((subFolder) =>
        deepCloneFolder(subFolder, newFolderId),
      )
      return {
        ...folder,
        id: newFolderId,
        parentId,
        items: newItems,
        folders: newSubFolders,
        expanded: false,
        timestamp: Date.now(),
      }
    }

    const pasteItem = (
      item: TItem | Folder<TItem>,
      targetFolderId: string,
      itemType: 'verse' | 'file' | 'folder',
    ) => {
      if (itemType === 'verse' || itemType === 'file') {
        const newItem: TItem = { ...(item as TItem), id: uuidv4(), timestamp: Date.now() }
        if (targetFolderId === config.rootId) {
          rootFolder.value.items.push(newItem as any)
          itemMap.set(newItem.id, newItem)
        } else {
          updateFolderInTree(rootFolder.value.folders as any, targetFolderId, (folder) => {
            folder.items.push(newItem as any)
            itemMap.set(newItem.id, newItem)
          })
        }
      } else {
        const newFolder = deepCloneFolder(item as Folder<TItem>, targetFolderId)
        if (targetFolderId === config.rootId) {
          rootFolder.value.folders.push(newFolder as any)
        } else {
          updateFolderInTree(rootFolder.value.folders as any, targetFolderId, (target) => {
            target.folders.push(newFolder as any)
          })
        }
        rebuildIndex()
      }
      saveRootFolder()
    }

    const loadChildren = async (folderId: string) => {
      const folder = folderMap.get(folderId)
      if (!folder || folder.isLoaded) return

      // Local/Default folders already have their structure in the store
      if (!folder.sourceType || folder.sourceType === 'local') {
        folder.isLoaded = true
        return
      }

      try {
        const providerName = folder.sourceType === 'sync' ? 'sync' : folder.sourceType
        const provider = fileSystemProviderFactory.getProvider(providerName)
        if (!provider.listDirectory) {
          folder.isLoaded = true
          return
        }
        const result = await provider.listDirectory(folder.id)
        if (result.success && result.data) {
          folder.items = []
          folder.folders = []
          result.data.forEach((entry: any) => {
            if ('type' in entry && entry.type === 'file') folder.items.push(entry as any)
            else folder.folders.push(entry as any)
          })
          folder.isLoaded = true
          rebuildIndex()
        }
      } catch (error) {
        console.error(`Failed to load children for folder ${folderId}:`, error)
      }
    }

    return {
      rootFolder,
      currentFolderPath,
      loadRootFolder,
      saveRootFolder,
      navigateToRoot,
      navigateToFolder,
      enterFolder,
      currentFolder,
      getCurrentFolders: folderManager.getCurrentFolders,
      getCurrentItems: folderManager.getCurrentItems,
      getFolderById,
      getMoveTargets,
      isFolderInside,
      addFolderToCurrent,
      addItemToCurrent,
      addItemToFolder,
      removeItemFromCurrent,
      updateFolder,
      updateItem,
      reorderCurrentItems,
      reorderCurrentFolders,
      deleteFolder,
      moveItem,
      moveFolder,
      pasteItem,
      loadChildren,
      clipboard,
      copyToClipboard,
      cutToClipboard,
      clearClipboard,
      viewMode,
    }
  })
}

export const useBibleFolderStore = () => {
  const useStore = useFolderStore<VerseItem>({
    rootId: BibleFolder.ROOT_ID,
    defaultRootName: BibleFolder.ROOT_NAME,
    storageCategory: StorageCategory.BIBLE,
  })
  return useStore()
}

export const useMediaFolderStore = () => {
  const useStore = useFolderStore<FileItem>({
    rootId: MediaFolder.ROOT_ID,
    defaultRootName: MediaFolder.ROOT_NAME,
    storageCategory: StorageCategory.MEDIA,
  })
  return useStore()
}
