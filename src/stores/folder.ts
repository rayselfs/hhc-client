/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useDebounceFn } from '@vueuse/core'
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

    const checkExpiredContent = (folder: Folder<TItem>): boolean => {
      let changed = false
      const now = Date.now()
      const initialItemsLength = folder.items.length
      folder.items = folder.items.filter((item) => !(item.expiresAt && item.expiresAt < now))
      if (folder.items.length !== initialItemsLength) changed = true

      const initialFoldersLength = folder.folders.length
      folder.folders = folder.folders.filter((subFolder) => {
        if (subFolder.expiresAt && subFolder.expiresAt < now) return false
        if (checkExpiredContent(subFolder)) changed = true
        return true
      })
      if (folder.folders.length !== initialFoldersLength) changed = true
      return changed
    }

    const saveRootFolder = useDebounceFn(async () => {
      try {
        await db.put(storeName, JSON.parse(JSON.stringify(rootFolder.value)))
      } catch (error) {
        console.error('Failed to save root folder to IndexedDB:', error)
      }
    }, 1000)

    const loadRootFolder = async () => {
      try {
        const savedFolder = await db.get<Folder<TItem>>(storeName, config.rootId)
        if (savedFolder && savedFolder.id === config.rootId) {
          rootFolder.value = savedFolder as any
          if (checkExpiredContent(rootFolder.value as any)) {
            await saveRootFolder()
          }
          rebuildIndex()
        } else {
          rebuildIndex()
        }
      } catch (error) {
        console.error('Failed to load root folder from IndexedDB:', error)
        rebuildIndex()
      }
    }

    watch(rootFolder, () => saveRootFolder(), { deep: true })

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
    }

    const addItemToCurrent = (item: TItem): void => {
      currentFolder.value.items.push(item as any)
      itemMap.set(item.id, item)
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
    }

    const deleteFolder = async (folderId: string) => {
      await deleteFolderRecursive(rootFolder.value.folders as any, folderId)
      rebuildIndex()
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
    }

    const reorderCurrentItems = (orderedItems: TItem[]) => {
      currentFolder.value.items = orderedItems as any
    }
    const reorderCurrentFolders = (orderedFolders: Folder<TItem>[]) => {
      currentFolder.value.folders = orderedFolders as any
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
    }

    const moveItem = (item: TItem, targetFolderId: string, sourceFolderId: string) => {
      if (sourceFolderId === config.rootId) {
        rootFolder.value.items = rootFolder.value.items.filter((i) => i.id !== item.id)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, sourceFolderId, (folder) => {
          folder.items = folder.items.filter((i) => i.id !== item.id)
        })
      }
      if (targetFolderId === config.rootId) {
        rootFolder.value.items.push(item as any)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, targetFolderId, (folder) => {
          folder.items.push(item as any)
        })
      }
    }

    const moveFolder = (
      folderToMove: Folder<TItem>,
      targetFolderId: string,
      sourceFolderId: string,
    ): boolean => {
      const targetFolder =
        targetFolderId === config.rootId ? rootFolder.value : getFolderById(targetFolderId)
      if (!targetFolder || isFolderInside(folderToMove as any, targetFolder as any)) return false

      if (sourceFolderId === config.rootId) {
        rootFolder.value.folders = rootFolder.value.folders.filter((f) => f.id !== folderToMove.id)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, sourceFolderId, (folder) => {
          folder.folders = folder.folders.filter((f) => f.id !== folderToMove.id)
        })
      }

      if (targetFolderId === config.rootId) {
        folderToMove.parentId = config.rootId
        rootFolder.value.folders.push(folderToMove as any)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, targetFolderId, (folder) => {
          folderToMove.parentId = targetFolder.id
          folder.folders.push(folderToMove as any)
        })
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
          result.data.forEach((entry) => {
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
