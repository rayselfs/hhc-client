import { ref } from 'vue'
import { useMediaFolderStore, useBibleFolderStore } from '@/stores/folder'
import { useFileSystem } from './useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useSentry } from '@/composables/useSentry'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { FolderDBStore } from '@/types/enum'
import type { FileItem, FolderDocument, ItemDocument } from '@/types/folder'

export function useFileCleanup() {
  const mediaStore = useMediaFolderStore()
  const bibleStore = useBibleFolderStore()
  const db = useIndexedDB(FOLDER_DB_CONFIG)
  const fileSystem = useFileSystem()

  // Singleton guard to prevent multiple simultaneous cleanups
  const isCleaning = ref(false)

  /**
   * Delete a folder and all its descendants from IndexedDB
   */
  const deleteFolderRecursive = async (folderId: string, isMedia: boolean): Promise<void> => {
    // Get all child folders
    const childFolders = await db.getByIndex<FolderDocument>(
      FolderDBStore.FOLDER_DB_FOLDERS_STORE_NAME,
      'parentId',
      folderId,
    )

    // Recursively delete child folders
    for (const child of childFolders) {
      await deleteFolderRecursive(child.id, isMedia)
    }

    // Get all items in this folder
    const items = await db.getByIndex<ItemDocument>(
      FolderDBStore.FOLDER_DB_ITEMS_STORE_NAME,
      'folderId',
      folderId,
    )

    // Delete physical files and thumbnails (Media only)
    if (isMedia) {
      const fileItems = items as FileItem[]

      // Delete physical files
      try {
        await fileSystem.deletePhysicalFilesRecursive(fileItems)
      } catch (e) {
        const { reportError } = useSentry()
        reportError(e, {
          operation: 'delete-physical-files-expired-items',
          component: 'useFileCleanup',
        })
      }

      // Delete thumbnails
      for (const item of fileItems) {
        if (item.metadata?.thumbnailBlobId) {
          await db.delete(
            FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
            item.metadata.thumbnailBlobId,
          )
        }
      }
    }

    // Batch delete items
    const itemIds = items.map((i) => i.id)
    await db.deleteBatch(FolderDBStore.FOLDER_DB_ITEMS_STORE_NAME, itemIds)

    // Delete the folder itself
    await db.delete(FolderDBStore.FOLDER_DB_FOLDERS_STORE_NAME, folderId)
  }

  /**
   * Run cleanup using IndexedDB indexes for efficient querying
   */
  const runCleanup = () => {
    if (isCleaning.value) return
    isCleaning.value = true

    const cleanupTask = async () => {
      try {
        const now = Date.now()

        // 1. Query expired items using expiresAt index
        const allItems = await db.getAll<ItemDocument>(FolderDBStore.FOLDER_DB_ITEMS_STORE_NAME)
        const expiredItems = allItems.filter((item) => item.expiresAt && item.expiresAt < now)

        if (expiredItems.length > 0) {
          // Separate media items for physical file deletion
          const mediaItems = expiredItems.filter((item) => item.type === 'file') as FileItem[]

          // Delete physical files (Media only)
          if (mediaItems.length > 0) {
            try {
              await fileSystem.deletePhysicalFilesRecursive(mediaItems)
            } catch (e) {
              const { reportError } = useSentry()
              reportError(e, {
                operation: 'delete-physical-files-expired-items-background',
                component: 'useFileCleanup',
              })
            }

            // Delete thumbnails
            for (const item of mediaItems) {
              if (item.metadata?.thumbnailBlobId) {
                await db.delete(
                  FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
                  item.metadata.thumbnailBlobId,
                )
              }
            }
          }

          // Batch delete expired items
          const expiredItemIds = expiredItems.map((i) => i.id)
          await db.deleteBatch(FolderDBStore.FOLDER_DB_ITEMS_STORE_NAME, expiredItemIds)
        }

        // 2. Query expired folders using expiresAt index
        const allFolders = await db.getAll<FolderDocument>(
          FolderDBStore.FOLDER_DB_FOLDERS_STORE_NAME,
        )
        const expiredFolders = allFolders.filter(
          (folder) => folder.expiresAt && folder.expiresAt < now,
        )

        for (const folder of expiredFolders) {
          // Determine if it's a media folder (check by looking at items or by convention)
          // For simplicity, we'll delete both media and bible expired folders the same way
          // but only delete physical files for media items
          await deleteFolderRecursive(folder.id, true) // Assume media for physical file deletion
        }

        // 3. Reload in-memory structures if any changes were made
        if (expiredItems.length > 0 || expiredFolders.length > 0) {
          await mediaStore.loadRootFolder()
          await bibleStore.loadRootFolder()
        }
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'background-cleanup',
          component: 'useFileCleanup',
        })
      } finally {
        isCleaning.value = false
      }
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(
        () => {
          cleanupTask()
        },
        { timeout: 5000 },
      )
    } else {
      // Fallback for environments without requestIdleCallback
      setTimeout(cleanupTask, 1000)
    }
  }

  return {
    runCleanup,
    isCleaning,
  }
}
