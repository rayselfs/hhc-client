import { ref } from 'vue'
import { useMediaFolderStore, useBibleFolderStore } from '@/stores/folder'
import { useFileSystem } from './useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { FolderDBStore } from '@/types/enum'
import type { Folder, FileItem, VerseItem } from '@/types/common'

export function useFileCleanup() {
  const mediaStore = useMediaFolderStore()
  const bibleStore = useBibleFolderStore()
  const db = useIndexedDB(FOLDER_DB_CONFIG)

  // Singleton guard to prevent multiple simultaneous cleanups
  const isCleaning = ref(false)

  const cleanupFolder = async <T extends FileItem | VerseItem>(
    folder: Folder<T>,
    store: ReturnType<typeof useMediaFolderStore> | ReturnType<typeof useBibleFolderStore>,
    performPhysicalDelete: boolean,
  ): Promise<boolean> => {
    let changed = false
    const now = Date.now()

    // 1. Check Files/Items
    const expiredItems = folder.items.filter((item) => item.expiresAt && item.expiresAt < now)

    if (expiredItems.length > 0) {
      // Physical Delete (only if requested, e.g. Media)
      if (performPhysicalDelete) {
        try {
          // We cast to any because deletePhysicalFilesRecursive expects generic FileItem/Folder structure
          // but we know VerseItems don't have URLs so they will be filtered out safely inside
          const fileSystem = useFileSystem()
          await fileSystem.deletePhysicalFilesRecursive(expiredItems as unknown as FileItem[])
        } catch (e) {
          console.error('Failed to delete physical files for expired items', e)
        }
      }

      // Thumbnail Cleanup (Media only usually, but safe to check)
      for (const item of expiredItems) {
        const fileItem = item as unknown as FileItem
        if (fileItem.metadata?.thumbnailBlobId) {
          await db.delete(
            FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
            fileItem.metadata.thumbnailBlobId,
          )
        }
      }

      // Store Update (Logical Removal)
      // We manually mock the action since we operate on the raw object here for recursion
      folder.items = folder.items.filter((item) => !expiredItems.includes(item))
      changed = true
    }

    // 2. Check Subfolders
    const expiredFolders: Folder<T>[] = []
    const activeFolders: Folder<T>[] = []

    for (const subFolder of folder.folders) {
      if (subFolder.expiresAt && subFolder.expiresAt < now) {
        expiredFolders.push(subFolder)
      } else {
        // Recursively check children
        if (await cleanupFolder(subFolder, store, performPhysicalDelete)) {
          changed = true
        }
        activeFolders.push(subFolder)
      }
    }

    // Delete Expired Folders
    if (expiredFolders.length > 0) {
      // Physical Delete
      if (performPhysicalDelete) {
        try {
          const fileSystem = useFileSystem()
          await fileSystem.deletePhysicalFilesRecursive(
            expiredFolders as unknown as Folder<FileItem>[],
          )
        } catch (e) {
          console.error('Failed to delete physical folders', e)
        }
      }

      // Thumbnail Cleanup for items inside expired folders
      for (const expFolder of expiredFolders) {
        const cleanThumbnails = async (f: Folder<T>) => {
          for (const item of f.items) {
            // Check if it's a FileItem with metadata
            const fileItem = item as unknown as FileItem
            if (fileItem.metadata?.thumbnailBlobId) {
              await db.delete(
                FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
                fileItem.metadata.thumbnailBlobId,
              )
            }
          }
          for (const sub of f.folders) {
            await cleanThumbnails(sub)
          }
        }
        await cleanThumbnails(expFolder)
      }

      folder.folders = activeFolders
      changed = true
    }

    return changed
  }

  const runCleanup = () => {
    if (isCleaning.value) return
    isCleaning.value = true

    const cleanupTask = async () => {
      try {
        // Bible Cleanup (Logical Only)
        if (bibleStore.rootFolder) {
          const changed = await cleanupFolder(bibleStore.rootFolder, bibleStore, false)
          if (changed) {
            bibleStore.saveRootFolder()
          }
        }

        // Media Cleanup
        if (mediaStore.rootFolder) {
          const changed = await cleanupFolder(mediaStore.rootFolder, mediaStore, true)
          if (changed) {
            mediaStore.saveRootFolder()
          }
        }
      } catch (error) {
        console.error('Background cleanup failed:', error)
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
