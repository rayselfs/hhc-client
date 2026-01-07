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
