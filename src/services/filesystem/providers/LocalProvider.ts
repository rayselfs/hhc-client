import type { FileItem, Folder } from '@/types/common'
import type {
  FileSystemProvider,
  ProviderResult,
  SaveFileResult,
  FileOperationOptions,
  ItemPermissions,
} from '../types'
import { DEFAULT_LOCAL_PERMISSIONS, createSuccessResult, createFailureResult } from '../types'

/**
 * LocalProvider - File system provider for Electron local storage
 *
 * Uses Electron IPC to interact with the main process for file operations.
 * Files are stored in the app's userData directory.
 */
export class LocalProvider implements FileSystemProvider {
  readonly type = 'local' as const
  readonly displayName = 'Local Storage'
  readonly urlPrefix = 'local-resource://'

  private _isAvailable = false

  // ─── Lifecycle ───────────────────────────────────────────────────────

  async initialize(): Promise<ProviderResult<void>> {
    this._isAvailable = this.checkElectronEnvironment()

    if (!this._isAvailable) {
      return createFailureResult('Electron environment not available', 'NOT_AVAILABLE')
    }

    return createSuccessResult(undefined)
  }

  isAvailable(): boolean {
    return this._isAvailable
  }

  private checkElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  // ─── File Operations ─────────────────────────────────────────────────
  async saveFile(
    sourcePath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: FileOperationOptions,
  ): Promise<ProviderResult<SaveFileResult>> {
    if (!this._isAvailable) {
      return createFailureResult('Provider not available', 'NOT_AVAILABLE')
    }

    try {
      const result = await window.electronAPI.saveFile(sourcePath)

      return createSuccessResult({
        filePath: result.filePath,
        thumbnailPath: result.thumbnailPath,
        fileUrl: this.buildUrl(result.filePath),
        thumbnailUrl: result.thumbnailPath ? this.buildUrl(result.thumbnailPath) : undefined,
      })
    } catch (error) {
      return createFailureResult(error instanceof Error ? error.message : String(error), 'UNKNOWN')
    }
  }

  async deleteFile(fileUrl: string): Promise<ProviderResult<void>> {
    if (!this._isAvailable) {
      return createFailureResult('Provider not available', 'NOT_AVAILABLE')
    }

    if (!this.canHandle(fileUrl)) {
      return createFailureResult(`Invalid URL for local provider: ${fileUrl}`, 'INVALID_PATH')
    }

    try {
      const filePath = this.extractPath(fileUrl)
      const success = await window.electronAPI.deleteFile(filePath)

      if (success) {
        return createSuccessResult(undefined)
      } else {
        return createFailureResult('Failed to delete file', 'UNKNOWN')
      }
    } catch (error) {
      return createFailureResult(error instanceof Error ? error.message : String(error), 'UNKNOWN')
    }
  }

  async deleteThumbnail(thumbnailUrl: string): Promise<ProviderResult<void>> {
    // Reuse deleteFile logic for thumbnails
    return this.deleteFile(thumbnailUrl)
  }

  async copyFile(fileUrl: string): Promise<ProviderResult<SaveFileResult>> {
    if (!this._isAvailable) {
      return createFailureResult('Provider not available', 'NOT_AVAILABLE')
    }

    if (!this.canHandle(fileUrl)) {
      return createFailureResult(`Invalid URL for local provider: ${fileUrl}`, 'INVALID_PATH')
    }

    try {
      const result = await window.electronAPI.copyFile(fileUrl)

      if (!result) {
        return createFailureResult('Failed to copy file', 'UNKNOWN')
      }

      return createSuccessResult({
        filePath: result.filePath,
        thumbnailPath: result.thumbnailPath,
        fileUrl: this.buildUrl(result.filePath),
        thumbnailUrl: result.thumbnailPath ? this.buildUrl(result.thumbnailPath) : undefined,
      })
    } catch (error) {
      return createFailureResult(error instanceof Error ? error.message : String(error), 'UNKNOWN')
    }
  }

  // ─── URL Utilities ───────────────────────────────────────────────────

  canHandle(url: string): boolean {
    return url.startsWith(this.urlPrefix)
  }

  extractPath(fileUrl: string): string {
    if (!this.canHandle(fileUrl)) {
      return fileUrl
    }
    return fileUrl.slice(this.urlPrefix.length)
  }

  buildUrl(filePath: string): string {
    // Avoid double prefix
    if (filePath.startsWith(this.urlPrefix)) {
      return filePath
    }
    return `${this.urlPrefix}${filePath}`
  }

  // ─── Permissions ─────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPermissions(_item: FileItem | Folder<FileItem>): ItemPermissions {
    // Local files always have full permissions
    return { ...DEFAULT_LOCAL_PERMISSIONS }
  }

  /**
   * List contents of a directory (Lazy Loading support)
   */
  async listDirectory(path: string): Promise<ProviderResult<Array<FileItem | Folder<FileItem>>>> {
    if (!this._isAvailable) {
      return createFailureResult('Provider not available', 'NOT_AVAILABLE')
    }

    try {
      const entries = await window.electronAPI.listDirectory(path)

      const result = entries.map((entry) => {
        if (entry.isDirectory) {
          const folder: Folder<FileItem> = {
            id: entry.path, // Use full path as ID for local files
            name: entry.name,
            items: [],
            folders: [],
            parentId: path,
            timestamp: entry.modifiedAt,
            sourceType: this.type,
            permissions: this.getPermissions({} as FileItem),
            isLoaded: false,
          }
          return folder
        } else {
          const item: FileItem = {
            id: entry.path,
            name: entry.name,
            url: this.buildUrl(entry.path),
            type: 'file',
            timestamp: entry.modifiedAt,
            size: entry.size,
            sourceType: this.type,
            permissions: this.getPermissions({} as FileItem),
            metadata: {
              fileType: this.getFileType(entry.name),
              filePath: entry.path,
              thumbnailPath: entry.thumbnailPath,
              fileUrl: this.buildUrl(entry.path),
              thumbnailUrl: entry.thumbnailPath ? this.buildUrl(entry.thumbnailPath) : undefined,
            },
          }
          return item
        }
      })

      return createSuccessResult(result)
    } catch (error) {
      return createFailureResult(error instanceof Error ? error.message : String(error), 'UNKNOWN')
    }
  }

  // Helper to determine file type from extension
  private getFileType(filename: string): 'image' | 'video' | 'audio' | 'pdf' | 'document' {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext) return 'document'

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'aac'].includes(ext)) return 'audio'
    if (ext === 'pdf') return 'pdf'
    return 'document'
  }

  // ─── Static Utilities ────────────────────────────────────────────────

  /**
   * Get the native file path from a File object
   * Only works in Electron environment
   */
  getFilePath(file: File): string {
    if (!this._isAvailable) {
      return ''
    }
    return window.electronAPI.getFilePath(file)
  }
}

/**
 * Singleton instance for the local provider
 */
let localProviderInstance: LocalProvider | null = null

/**
 * Get the singleton LocalProvider instance
 */
export function getLocalProvider(): LocalProvider {
  if (!localProviderInstance) {
    localProviderInstance = new LocalProvider()
  }
  return localProviderInstance
}
