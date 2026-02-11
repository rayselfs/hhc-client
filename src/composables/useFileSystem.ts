import { ref, computed } from 'vue'

import { useSentry } from '@/composables/useSentry'
import {
  fileSystemProviderFactory,
  type FileSystemProvider,
  type FileSourceType,
  type ProviderResult,
  type SaveFileResult,
  type ItemPermissions,
  DEFAULT_LOCAL_PERMISSIONS,
} from '@/services/filesystem'
import type { FileItem, Folder } from '@/types/folder'
import { LocalProvider } from '@/services/filesystem/providers/LocalProvider'

/**
 * useFileSystem composable
 *
 * Provides a unified interface for file system operations across different providers.
 * Abstracts away the complexity of dealing with multiple storage backends.
 *
 * Usage:
 * ```typescript
 * const { initialize, saveFile, deleteFile, copyFile } = useFileSystem()
 *
 * // Initialize once at app startup
 * await initialize()
 *
 * // Save a file
 * const result = await saveFile('/path/to/file')
 * if (result.success) {
 *   console.log('Saved to:', result.data.fileUrl)
 * }
 * ```
 */
export function useFileSystem() {
  const initialized = ref(false)
  const initializing = ref(false)
  const currentProviderType = ref<FileSourceType>('sync')

  /**
   * Initialize the file system providers
   * Should be called once at application startup
   */
  const initialize = async (): Promise<ProviderResult<void>> => {
    if (initialized.value) {
      return { success: true }
    }

    if (initializing.value) {
      // Wait for ongoing initialization
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (initialized.value) {
            clearInterval(checkInterval)
            resolve({ success: true })
          }
        }, 50)
      })
    }

    initializing.value = true

    try {
      const result = await fileSystemProviderFactory.initialize()
      initialized.value = result.success
      return result
    } finally {
      initializing.value = false
    }
  }

  /**
   * Check if the file system is initialized
   */
  const isInitialized = computed(() => initialized.value)

  /**
   * Check if we're running in Electron environment
   */
  const isElectron = computed(() => {
    return typeof window !== 'undefined' && !!window.electronAPI
  })

  /**
   * Get the current provider
   */
  const getProvider = (type?: FileSourceType): FileSystemProvider => {
    return fileSystemProviderFactory.getProvider(type || currentProviderType.value)
  }

  /**
   * Get the provider for a specific file item based on its URL
   */
  const getProviderForItem = (item: FileItem): FileSystemProvider => {
    return fileSystemProviderFactory.getProviderForUrl(item.url)
  }

  /**
   * Get the provider for a URL
   */
  const getProviderForUrl = (url: string): FileSystemProvider => {
    return fileSystemProviderFactory.getProviderForUrl(url)
  }

  // ─── File Operations ─────────────────────────────────────────────────

  /**
   * Save a file to the current provider
   * @param sourcePath - Source file path (from file input or drag/drop)
   */
  const saveFile = async (sourcePath: string): Promise<ProviderResult<SaveFileResult>> => {
    if (!initialized.value) {
      await initialize()
    }

    const provider = getProvider()
    return provider.saveFile(sourcePath)
  }

  /**
   * Delete a file
   * Automatically selects the correct provider based on the file's URL
   * @param item - The file item to delete
   */
  const deleteFile = async (item: FileItem): Promise<ProviderResult<void>> => {
    if (!initialized.value) {
      await initialize()
    }

    const provider = getProviderForItem(item)

    // Check permissions
    const permissions = provider.getPermissions(item)
    if (!permissions.canDelete) {
      return {
        success: false,
        error: 'Permission denied: Cannot delete this file',
        code: 'PERMISSION_DENIED',
      }
    }

    // Delete the main file
    const result = await provider.deleteFile(item.url)

    // Also delete thumbnail if exists
    if (result.success && item.metadata?.thumbnailUrl) {
      await provider.deleteThumbnail(item.metadata.thumbnailUrl)
    }

    return result
  }

  /**
   * Delete multiple files
   * @param items - Array of file items to delete
   */
  const deleteFiles = async (
    items: FileItem[],
  ): Promise<{ succeeded: FileItem[]; failed: Array<{ item: FileItem; error: string }> }> => {
    const succeeded: FileItem[] = []
    const failed: Array<{ item: FileItem; error: string }> = []

    for (const item of items) {
      const result = await deleteFile(item)
      if (result.success) {
        succeeded.push(item)
      } else {
        failed.push({ item, error: result.error || 'Unknown error' })
      }
    }

    return { succeeded, failed }
  }

  /**
   * Delete physical files from storage recursively
   * Collects all files recursively from folders and deletes them
   * SAFELY SKIPS deletion if the items do not belong to file system (e.g. Bible verses)
   */
  const deletePhysicalFilesRecursive = async (
    items: (FileItem | Folder<FileItem>)[],
  ): Promise<{ succeeded: FileItem[]; failed: Array<{ item: FileItem; error: string }> }> => {
    // Collect all files to delete (including nested files in folders)
    const filesToDelete: FileItem[] = []

    const collectFiles = (item: FileItem | Folder<FileItem>) => {
      // Basic check: if it's a "VerseItem", it likely won't have 'items' array of files,
      // but let's be more robust. If it's a folder, traverse.
      if ('items' in item && Array.isArray(item.items)) {
        // It's a folder - recursively collect files
        item.items.forEach((subItem) => {
          // Double check it's a file
          if (!('items' in subItem)) {
            filesToDelete.push(subItem as FileItem)
          }
        })
        item.folders.forEach(collectFiles)
      } else if (!('items' in item)) {
        // It's a file
        filesToDelete.push(item as FileItem)
      }
    }

    items.forEach(collectFiles)

    // Filter out items that are not actual files (e.g. Bible verses)
    // We can assume 'url' presence or specific metadata check if needed.
    // Verses don't have `url` usually. FileItems do.
    const filesWithUrl = filesToDelete.filter((f) => !!f.url)

    if (filesWithUrl.length === 0) {
      return { succeeded: [], failed: [] }
    }

    return deleteFiles(filesWithUrl)
  }

  /**
   * Copy a file
   * @param item - The file item to copy
   */
  const copyFile = async (item: FileItem): Promise<ProviderResult<SaveFileResult>> => {
    if (!initialized.value) {
      await initialize()
    }

    const provider = getProviderForItem(item)
    return provider.copyFile(item.url)
  }

  // ─── Permissions ─────────────────────────────────────────────────────

  /**
   * Get permissions for a file item
   */
  const getPermissions = (item: FileItem | Folder<FileItem>): ItemPermissions => {
    // If item already has permissions, return them
    if (item.permissions) {
      return item.permissions
    }

    // Otherwise, get from provider
    if (!initialized.value) {
      // Return default permissions if not initialized
      return { ...DEFAULT_LOCAL_PERMISSIONS }
    }

    const provider =
      'url' in item ? getProviderForItem(item as FileItem) : getProvider(item.sourceType || 'sync')

    return provider.getPermissions(item)
  }

  /**
   * Check if an item can be deleted
   */
  const canDelete = (item: FileItem | Folder<FileItem>): boolean => {
    return getPermissions(item).canDelete
  }

  /**
   * Check if an item can be renamed
   */
  const canRename = (item: FileItem | Folder<FileItem>): boolean => {
    return getPermissions(item).canRename
  }

  /**
   * Check if an item can be moved
   */
  const canMove = (item: FileItem | Folder<FileItem>): boolean => {
    return getPermissions(item).canMove
  }

  /**
   * Check if an item can be edited
   */
  const canEdit = (item: FileItem | Folder<FileItem>): boolean => {
    return getPermissions(item).canEdit
  }

  // ─── URL Utilities ───────────────────────────────────────────────────

  /**
   * Check if a URL is a local resource
   */
  const isLocalUrl = (url: string): boolean => {
    return url.startsWith('local-resource://')
  }

  /**
   * Check if a file item is from local storage
   */
  const isLocal = (item: FileItem): boolean => {
    return item.sourceType === 'local' || item.sourceType === 'sync' || isLocalUrl(item.url)
  }

  /**
   * Get the file path from a File object (Electron only)
   */
  const getFilePath = (file: File): string => {
    if (!isElectron.value) {
      return ''
    }

    try {
      const localProvider = getProvider('sync') as LocalProvider
      return localProvider.getFilePath(file)
    } catch {
      // Fallback to direct API call if provider not ready
      const { reportError } = useSentry()
      if (window.electronAPI?.getFilePath) {
        return window.electronAPI.getFilePath(file)
      }
      reportError(new Error('getFilePath failed: provider not ready and electronAPI unavailable'), {
        operation: 'get-file-path',
        component: 'useFileSystem',
        extra: { fileName: file.name },
      })
      return ''
    }
  }

  // ─── Provider Info ───────────────────────────────────────────────────

  /**
   * Get all available provider types
   */
  const availableProviders = computed(() => {
    return fileSystemProviderFactory.getAvailableTypes()
  })

  /**
   * Check if a specific provider is available
   */
  const hasProvider = (type: FileSourceType): boolean => {
    return fileSystemProviderFactory.hasProvider(type)
  }

  /**
   * Set the current provider type
   */
  const setCurrentProvider = (type: FileSourceType): void => {
    if (!fileSystemProviderFactory.hasProvider(type)) {
      throw new Error(`Provider not available: ${type}`)
    }
    currentProviderType.value = type
  }

  return {
    // State
    initialized: isInitialized,
    isElectron,
    currentProviderType,
    availableProviders,

    // Lifecycle
    initialize,

    // File operations
    saveFile,
    deleteFile,
    deleteFiles,
    copyFile,

    // Permissions
    getPermissions,
    canDelete,
    canRename,
    canMove,
    canEdit,

    // URL utilities
    isLocalUrl,
    isLocal,
    getFilePath,

    // Provider management
    getProvider,
    getProviderForItem,
    getProviderForUrl,
    hasProvider,
    setCurrentProvider,
    deletePhysicalFilesRecursive,
  }
}
