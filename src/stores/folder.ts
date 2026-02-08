/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useI18n } from 'vue-i18n'
import { useSnackBar } from '@/composables/useSnackBar'
import {
  type Folder,
  type FolderItem,
  type ClipboardItem,
  type FolderStoreConfig,
  type FolderDocument,
} from '@/types/common'
import { useFolderManager } from '@/composables/useFolderManager'
import { fileSystemProviderFactory } from '@/services/filesystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { FolderDBStore, MediaFolder } from '@/types/enum'
import { BibleFolder } from '@/types/enum'
import { StorageCategory } from '@/types/common'
import type { VerseItem, FileItem } from '@/types/common'
import { useSentry } from '@/composables/useSentry'

/**
 * Generic folder store for managing folder tree structure
 * Uses separate IndexedDB stores for folders and items (flattened structure)
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
    const viewMode = ref<'large' | 'medium' | 'small'>('medium')
    // Version counter to trigger reactivity when folder/item content changes
    const contentVersion = ref(0)

    // Composables
    const { t } = useI18n()
    const { showSnackBar } = useSnackBar()

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

    // Helper to trigger reactivity for content changes
    const triggerContentUpdate = () => {
      contentVersion.value++
    }

    const folderManager = useFolderManager(rootFolder, currentFolderPath, {
      rootId: config.rootId,
      folderMap: folderMap as any,
      itemMap: itemMap as any,
      contentVersion,
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
    const foldersStoreName = FolderDBStore.FOLDER_DB_FOLDERS_STORE_NAME
    const itemsStoreName = FolderDBStore.FOLDER_DB_ITEMS_STORE_NAME
    const thumbnailsStoreName = FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME

    // ==========================================
    // Helper: Convert Folder to FolderDocument (strips Vue reactive proxies)
    // ==========================================
    const toFolderDocument = (folder: Folder<TItem>): FolderDocument => {
      const doc: FolderDocument = {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId || null,
        expanded: folder.expanded,
        timestamp: folder.timestamp,
        expiresAt: folder.expiresAt,
        sortIndex: folder.sortIndex,
        sourceType: folder.sourceType,
        permissions: folder.permissions
          ? JSON.parse(JSON.stringify(folder.permissions))
          : undefined,
        viewSettings: folder.viewSettings
          ? JSON.parse(JSON.stringify(folder.viewSettings))
          : undefined,
        cloudId: folder.cloudId,
        syncPath: folder.syncPath,
        isLoaded: folder.isLoaded,
      }
      return doc
    }

    // ==========================================
    // Single Document Operations
    // ==========================================
    const saveFolderDoc = async (folder: Folder<TItem>): Promise<void> => {
      try {
        await db.put(foldersStoreName, toFolderDocument(folder))
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'save-folder-document',
          component: 'FolderStore',
          extra: { folderId: folder.id, folderName: folder.name },
        })
      }
    }

    const saveItemDoc = async (item: TItem): Promise<void> => {
      try {
        // Convert to plain object to strip Vue reactive proxies
        const plainItem = JSON.parse(JSON.stringify(item)) as TItem
        await db.put(itemsStoreName, plainItem)
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'save-item-document',
          component: 'FolderStore',
          extra: { itemId: item.id },
        })
      }
    }

    const deleteFolderDoc = async (folderId: string): Promise<void> => {
      try {
        await db.delete(foldersStoreName, folderId)
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'delete-folder-document',
          component: 'FolderStore',
          extra: { folderId },
        })
      }
    }

    const deleteItemDoc = async (itemId: string): Promise<void> => {
      try {
        await db.delete(itemsStoreName, itemId)
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'delete-item-document',
          component: 'FolderStore',
          extra: { itemId },
        })
      }
    }

    // ==========================================
    // Batch Operations
    // ==========================================
    const saveFolderTreeBatch = async (folder: Folder<TItem>): Promise<void> => {
      const folders: FolderDocument[] = []
      const items: TItem[] = []

      const collect = (f: Folder<TItem>) => {
        folders.push(toFolderDocument(f))
        f.items.forEach((item) => items.push(item))
        f.folders.forEach((sub) => collect(sub))
      }
      collect(folder)

      try {
        await db.putBatch(foldersStoreName, folders)
        // Convert items to plain objects to strip Vue reactive proxies
        const plainItems = JSON.parse(JSON.stringify(items)) as TItem[]
        await db.putBatch(itemsStoreName, plainItems)
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'save-folder-tree-batch',
          component: 'FolderStore',
          extra: { folderId: folder.id, folderCount: folders.length, itemCount: items.length },
        })
      }
    }

    // ==========================================
    // Delete folder with all descendants
    // ==========================================
    const deleteFolderRecursive = async (folders: Folder<TItem>[], folderId: string) => {
      const folderToRemove = folderMap.get(folderId)
      if (folderToRemove) {
        // Collect all item IDs and folder IDs to delete
        const itemIds: string[] = []
        const folderIds: string[] = []

        const collectIds = (f: Folder<TItem>) => {
          folderIds.push(f.id)
          f.items.forEach((item) => itemIds.push(item.id))
          f.folders.forEach((sub) => collectIds(sub))
        }
        collectIds(folderToRemove)

        // Delete thumbnails for all items
        for (const itemId of itemIds) {
          const item = itemMap.get(itemId)
          if ((item as any)?.metadata?.thumbnailBlobId) {
            await db.delete(thumbnailsStoreName, (item as any).metadata.thumbnailBlobId)
          }
        }

        // Batch delete from IndexedDB
        await db.deleteBatch(itemsStoreName, itemIds)
        await db.deleteBatch(foldersStoreName, folderIds)
      }

      // Remove from in-memory tree
      _deleteFolderRecursive(folders as any, folderId)
    }

    // ==========================================
    // Load from IndexedDB
    // ==========================================
    const loadRootFolder = async () => {
      try {
        // 1. Check if this specific root folder exists
        const existingRoot = await db.get<FolderDocument>(foldersStoreName, config.rootId)

        // If root folder doesn't exist, initialize it
        if (!existingRoot) {
          await saveFolderDoc(rootFolder.value as Folder<TItem>)
          rebuildIndex()
          return
        }

        // 2. Load all folders and items for this root
        const allFolders = await db.getAll<FolderDocument>(foldersStoreName)
        const allItems = await db.getAll<TItem>(itemsStoreName)

        // 3. Build parentId -> children mapping
        const folderChildrenMap = new Map<string | null, FolderDocument[]>()
        const itemParentMap = new Map<string, TItem[]>()

        allFolders.forEach((f) => {
          const parentId = f.parentId
          const siblings = folderChildrenMap.get(parentId) || []
          siblings.push(f)
          folderChildrenMap.set(parentId, siblings)
        })

        allItems.forEach((i) => {
          const folderId = (i as any).folderId
          const siblings = itemParentMap.get(folderId) || []
          siblings.push(i)
          itemParentMap.set(folderId, siblings)
        })

        // 4. Recursively build tree structure
        const buildTree = (folderId: string): Folder<TItem> | null => {
          const doc = allFolders.find((f) => f.id === folderId)
          if (!doc) return null

          const children = folderChildrenMap.get(folderId) || []
          const items = itemParentMap.get(folderId) || []

          // Sort children by sortIndex (undefined values go to end, then by timestamp)
          const sortedChildren = [...children].sort((a, b) => {
            if (a.sortIndex !== undefined && b.sortIndex !== undefined) {
              return a.sortIndex - b.sortIndex
            }
            if (a.sortIndex !== undefined) return -1
            if (b.sortIndex !== undefined) return 1
            return a.timestamp - b.timestamp
          })

          // Sort items by sortIndex (undefined values go to end, then by timestamp)
          const sortedItems = [...items].sort((a, b) => {
            const aIndex = (a as any).sortIndex
            const bIndex = (b as any).sortIndex
            if (aIndex !== undefined && bIndex !== undefined) {
              return aIndex - bIndex
            }
            if (aIndex !== undefined) return -1
            if (bIndex !== undefined) return 1
            return a.timestamp - b.timestamp
          })

          const childFolders: Folder<TItem>[] = []
          for (const child of sortedChildren) {
            const built = buildTree(child.id)
            if (built) childFolders.push(built)
          }

          return {
            id: doc.id,
            name: doc.name,
            expanded: doc.expanded,
            items: sortedItems,
            folders: childFolders,
            parentId: doc.parentId || undefined,
            timestamp: doc.timestamp,
            expiresAt: doc.expiresAt,
            sortIndex: doc.sortIndex,
            sourceType: doc.sourceType,
            permissions: doc.permissions,
            viewSettings: doc.viewSettings,
            cloudId: doc.cloudId,
            syncPath: doc.syncPath,
            isLoaded: doc.isLoaded,
          } as Folder<TItem>
        }

        const built = buildTree(config.rootId)
        if (built) {
          rootFolder.value = built as any
        }

        rebuildIndex()
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'load-root-folder',
          component: 'FolderStore',
          extra: { rootId: config.rootId },
        })
      }
    }

    // ==========================================
    // Clipboard operations
    // ==========================================
    const copyToClipboard = (items: ClipboardItem<TItem>[]) => {
      clipboard.value = items
      showSnackBar(t('fileExplorer.clipboardCopied'), {
        timeout: 3000,
        location: 'bottom left',
      })
    }
    const cutToClipboard = (items: ClipboardItem<TItem>[]) => {
      clipboard.value = items
      showSnackBar(t('fileExplorer.clipboardCut'), {
        timeout: 3000,
        location: 'bottom left',
      })
    }
    const clearClipboard = () => {
      clipboard.value = []
    }
    const hasClipboardItems = () => {
      return clipboard.value.length > 0
    }

    // ==========================================
    // Navigation
    // ==========================================
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

    // ==========================================
    // Add operations
    // ==========================================
    const addFolderToCurrent = async (name: string, expiresAt?: number | null) => {
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
      // Trigger reactivity by reassigning the array
      currentFolder.value.folders = [...currentFolder.value.folders, newFolder] as any
      folderMap.set(newFolder.id, newFolder)
      triggerContentUpdate()

      // Save to IndexedDB
      await saveFolderDoc(newFolder)
    }

    const addItemToCurrent = async (item: TItem): Promise<void> => {
      // Ensure folderId is set
      ;(item as any).folderId = currentFolder.value.id
      // Trigger reactivity by reassigning the array
      currentFolder.value.items = [...currentFolder.value.items, item] as any
      itemMap.set(item.id, item)
      triggerContentUpdate()

      // Save to IndexedDB
      await saveItemDoc(item)
    }

    const removeItemFromCurrent = async (itemId: string) => {
      const item = itemMap.get(itemId)

      // Delete thumbnail if exists
      if ((item as any)?.metadata?.thumbnailBlobId) {
        await db.delete(thumbnailsStoreName, (item as any).metadata.thumbnailBlobId)
      }

      // Delete from IndexedDB
      await deleteItemDoc(itemId)

      // Remove from in-memory
      currentFolder.value.items = currentFolder.value.items.filter((item) => item.id !== itemId)
      itemMap.delete(itemId)
      triggerContentUpdate()
    }

    const addItemToFolder = async (folderId: string, item: TItem) => {
      // Ensure folderId is set
      ;(item as any).folderId = folderId

      if (folderId === config.rootId) {
        rootFolder.value.items = [...rootFolder.value.items, item] as any
        itemMap.set(item.id, item)
      } else {
        updateFolderInTree(rootFolder.value.folders as any, folderId, (folder) => {
          folder.items = [...folder.items, item] as any
          itemMap.set(item.id, item)
        })
      }
      triggerContentUpdate()

      // Save to IndexedDB
      await saveItemDoc(item)
    }

    // ==========================================
    // Delete operations
    // ==========================================
    const deleteFolder = async (folderId: string) => {
      await deleteFolderRecursive(rootFolder.value.folders as any, folderId)
      rebuildIndex()
      triggerContentUpdate()
    }

    // ==========================================
    // Update operations
    // ==========================================
    const updateFolder = async (
      folderId: string,
      updates: { name?: string; expiresAt?: number | null },
    ) => {
      const folder = folderMap.get(folderId)
      if (folder) {
        if (updates.name !== undefined) folder.name = updates.name.trim()
        if (updates.expiresAt !== undefined) folder.expiresAt = updates.expiresAt
        folder.timestamp = Date.now()
        triggerContentUpdate()

        // Save to IndexedDB
        await saveFolderDoc(folder)
      }
    }

    const reorderCurrentItems = async (orderedItems: TItem[]) => {
      // Update sortIndex for each item based on new order
      orderedItems.forEach((item, index) => {
        ;(item as any).sortIndex = index
      })
      currentFolder.value.items = [...orderedItems] as any
      triggerContentUpdate()

      // Save all items - convert to plain objects to strip Vue reactive proxies
      const plainItems = JSON.parse(JSON.stringify(orderedItems)) as TItem[]
      await db.putBatch(itemsStoreName, plainItems)
    }

    const reorderCurrentFolders = async (orderedFolders: Folder<TItem>[]) => {
      // Update sortIndex for each folder based on new order
      orderedFolders.forEach((folder, index) => {
        folder.sortIndex = index
      })
      currentFolder.value.folders = [...orderedFolders] as any
      triggerContentUpdate()

      // Save all folders
      const docs = orderedFolders.map(toFolderDocument)
      await db.putBatch(foldersStoreName, docs)
    }

    const updateItem = async (itemId: string, folderId: string, updates: Partial<TItem>) => {
      const item = itemMap.get(itemId)
      if (item) {
        Object.assign(item, updates)
        triggerContentUpdate()

        // Save to IndexedDB
        await saveItemDoc(item)
      }
    }

    // ==========================================
    // Move operations
    // ==========================================
    const moveItem = async (item: TItem, targetFolderId: string, sourceFolderId: string) => {
      const sourceFolder =
        sourceFolderId === config.rootId ? rootFolder.value : folderMap.get(sourceFolderId)
      const targetFolder =
        targetFolderId === config.rootId ? rootFolder.value : folderMap.get(targetFolderId)

      if (!sourceFolder || !targetFolder) {
        const { reportError } = useSentry()
        reportError(new Error('moveItem: source or target folder not found'), {
          operation: 'move-item',
          component: 'FolderStore',
          extra: { sourceFolderId, targetFolderId, itemId: item.id },
        })
        return
      }

      // Remove from source (reassign to trigger reactivity)
      sourceFolder.items = sourceFolder.items.filter((i) => i.id !== item.id) as any

      // Update folderId and add to target (reassign to trigger reactivity)
      ;(item as any).folderId = targetFolderId
      targetFolder.items = [...targetFolder.items, item] as any
      triggerContentUpdate()

      // Save to IndexedDB
      await saveItemDoc(item)
    }

    const moveFolder = async (
      folderToMove: Folder<TItem>,
      targetFolderId: string,
      sourceFolderId: string,
      skipSave = false,
    ): Promise<boolean> => {
      const targetFolder =
        targetFolderId === config.rootId ? rootFolder.value : folderMap.get(targetFolderId)
      const sourceFolder =
        sourceFolderId === config.rootId ? rootFolder.value : folderMap.get(sourceFolderId)

      if (!targetFolder || !sourceFolder) {
        const { reportError } = useSentry()
        reportError(new Error('moveFolder: source or target folder not found'), {
          operation: 'move-folder',
          component: 'FolderStore',
          extra: { sourceFolderId, targetFolderId, folderId: folderToMove.id },
        })
        return false
      }

      if (isFolderInside(folderToMove as any, targetFolder as any)) return false

      // Remove from source (reassign to trigger reactivity)
      sourceFolder.folders = sourceFolder.folders.filter((f) => f.id !== folderToMove.id) as any

      // Update parentId and add to target (reassign to trigger reactivity)
      folderToMove.parentId = targetFolder.id
      targetFolder.folders = [...targetFolder.folders, folderToMove] as any
      triggerContentUpdate()

      if (!skipSave) {
        // Save to IndexedDB
        await saveFolderDoc(folderToMove)
      }
      return true
    }

    // ==========================================
    // Clone and paste operations
    // ==========================================
    const deepCloneFolder = (folder: Folder<TItem>, parentId: string): Folder<TItem> => {
      const newFolderId = uuidv4()
      const newItems = folder.items.map((item) => ({
        ...item,
        id: uuidv4(),
        folderId: newFolderId,
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

    const pasteItem = async (
      item: TItem | Folder<TItem>,
      targetFolderId: string,
      itemType: 'verse' | 'file' | 'folder',
    ) => {
      if (itemType === 'verse' || itemType === 'file') {
        const newItem: TItem = {
          ...(item as TItem),
          id: uuidv4(),
          folderId: targetFolderId,
          timestamp: Date.now(),
        } as TItem

        if (targetFolderId === config.rootId) {
          // Trigger reactivity by reassigning the array
          rootFolder.value.items = [...rootFolder.value.items, newItem] as any
          itemMap.set(newItem.id, newItem)
        } else {
          updateFolderInTree(rootFolder.value.folders as any, targetFolderId, (folder) => {
            // Trigger reactivity by reassigning the array
            folder.items = [...folder.items, newItem] as any
            itemMap.set(newItem.id, newItem)
          })
        }
        triggerContentUpdate()

        // Save to IndexedDB
        await saveItemDoc(newItem)
      } else {
        const newFolder = deepCloneFolder(item as Folder<TItem>, targetFolderId)
        if (targetFolderId === config.rootId) {
          // Trigger reactivity by reassigning the array
          rootFolder.value.folders = [...rootFolder.value.folders, newFolder] as any
        } else {
          updateFolderInTree(rootFolder.value.folders as any, targetFolderId, (target) => {
            // Trigger reactivity by reassigning the array
            target.folders = [...target.folders, newFolder] as any
          })
        }
        rebuildIndex()
        triggerContentUpdate()

        // Save entire folder tree to IndexedDB
        await saveFolderTreeBatch(newFolder)
      }
    }

    // ==========================================
    // Load children (for lazy loading)
    // ==========================================
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
          triggerContentUpdate()
        }
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'load-folder-children',
          component: 'FolderStore',
          extra: { folderId },
        })
      }
    }

    // ==========================================
    // View settings
    // ==========================================
    const updateFolderViewSettings = async (
      folderId: string,
      settings: Partial<import('@/types/common').FolderViewSettings>,
    ) => {
      const folder = folderMap.get(folderId)
      if (folder) {
        folder.viewSettings = {
          ...folder.viewSettings,
          ...settings,
        }

        // Save to IndexedDB
        await saveFolderDoc(folder)
      }
    }

    return {
      rootFolder,
      currentFolderPath,
      loadRootFolder,
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
      updateFolderViewSettings,
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
      hasClipboardItems,
      viewMode,
      // Expose for external use (e.g., cleanup)
      saveFolderDoc,
      saveItemDoc,
      deleteFolderDoc,
      deleteItemDoc,
      saveFolderTreeBatch,
      db,
      foldersStoreName,
      itemsStoreName,
      thumbnailsStoreName,
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
