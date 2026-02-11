import type {
  FileItem,
  Folder,
  FileMetadata,
  ItemPermissions,
  FileSourceType,
} from '@/types/folder'

export type { FileItem, Folder, FileMetadata, FileSourceType, ItemPermissions }

/**
 * Default permissions for local files (all allowed)
 */
export const DEFAULT_LOCAL_PERMISSIONS: ItemPermissions = {
  canDelete: true,
  canRename: true,
  canMove: true,
  canEdit: true,
  canPresent: true,
}

/**
 * Read-only permissions for sync folders
 */
export const READONLY_PERMISSIONS: ItemPermissions = {
  canDelete: false,
  canRename: false,
  canMove: false,
  canEdit: false,
  canPresent: true,
}

/**
 * Error codes for provider operations
 */
export type ProviderErrorCode =
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_PATH'
  | 'ALREADY_EXISTS'
  | 'NOT_AVAILABLE'
  | 'UNKNOWN'

/**
 * Result wrapper for async provider operations
 * Provides consistent error handling across all providers
 */
export interface ProviderResult<T> {
  success: boolean
  data?: T
  error?: string
  code?: ProviderErrorCode
}

/**
 * Result of a successful file save operation
 */
export interface SaveFileResult {
  /** Path to the saved file (relative to provider root) */
  filePath: string
  /** Binary data for the generated thumbnail */
  thumbnailData?: Uint8Array
  /** Full URL for accessing the file (e.g., local-resource://path) */
  fileUrl: string
  /** Video metadata (duration, mimeType) - only for video files */
  videoMetadata?: {
    duration: number
    mimeType: string
  }
}

/**
 * Options for file operations
 */
export interface FileOperationOptions {
  /** Generate thumbnail for images/videos */
  generateThumbnail?: boolean
  /** Overwrite existing file if exists */
  overwrite?: boolean
  /** Custom metadata to attach */
  metadata?: Partial<FileMetadata>
}

/**
 * Directory listing entry (for lazy loading)
 */
export interface DirectoryEntry {
  name: string
  isDirectory: boolean
  path: string
  size?: number
  modifiedAt?: number
  mimeType?: string
}

/**
 * FileSystemProvider interface
 * Abstract interface for different storage backends (local, cloud, sync)
 *
 * Implementations:
 * - LocalProvider: Electron file system via IPC
 * - CloudProvider: Google Drive API (future)
 * - SyncProvider: Read-only local directory watching (future)
 */
export interface FileSystemProvider {
  /** Provider type identifier */
  readonly type: FileSourceType

  /** Human-readable display name */
  readonly displayName: string

  /** URL protocol prefix (e.g., 'local-resource://', 'gdrive://') */
  readonly urlPrefix: string

  // ─── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Initialize the provider
   * Called once when the factory creates the provider
   */
  initialize(): Promise<ProviderResult<void>>

  /**
   * Check if the provider is available and ready to use
   * For Electron: checks if electronAPI exists
   * For Cloud: checks if authenticated
   */
  isAvailable(): boolean

  // ─── File Operations ─────────────────────────────────────────────────

  /**
   * Save a file to the provider's storage
   * @param sourcePath - Source file path (local filesystem path)
   * @param options - Optional save options
   */
  saveFile(
    sourcePath: string,
    options?: FileOperationOptions,
  ): Promise<ProviderResult<SaveFileResult>>

  /**
   * Delete a file from storage
   * @param fileUrl - Full URL of the file to delete
   */
  deleteFile(fileUrl: string): Promise<ProviderResult<void>>

  /**
   * Delete a thumbnail associated with a file
   * @param thumbnailUrl - Full URL of the thumbnail to delete
   */
  deleteThumbnail(thumbnailUrl: string): Promise<ProviderResult<void>>

  /**
   * Copy a file within the same provider
   * @param fileUrl - Full URL of the file to copy
   */
  copyFile(fileUrl: string): Promise<ProviderResult<SaveFileResult>>

  // ─── URL Utilities ───────────────────────────────────────────────────

  /**
   * Check if a URL belongs to this provider
   * @param url - URL to check
   */
  canHandle(url: string): boolean

  /**
   * Extract the file path from a full URL
   * @param fileUrl - Full URL (e.g., 'local-resource:///path/to/file')
   * @returns File path without protocol prefix
   */
  extractPath(fileUrl: string): string

  /**
   * Build a full URL from a file path
   * @param filePath - File path relative to provider root
   * @returns Full URL with protocol prefix
   */
  buildUrl(filePath: string): string

  // ─── Permissions ─────────────────────────────────────────────────────

  /**
   * Get permissions for an item
   * @param item - File or folder to check
   */
  getPermissions(item: FileItem | Folder<FileItem>): ItemPermissions

  /**
   * List contents of a directory (Lazy Loading support)
   * @param path - Directory path to list
   */
  listDirectory?(path: string): Promise<ProviderResult<Array<FileItem | Folder<FileItem>>>>
}

/**
 * Extended FileItem with source information
 * Used when displaying files from multiple sources
 */
export interface ExtendedFileItem extends FileItem {
  sourceType: FileSourceType
  permissions: ItemPermissions
  /** Cloud provider file ID (for cloud sources) */
  cloudId?: string
  /** Local filesystem path (for sync sources) */
  syncPath?: string
  /** Last sync timestamp */
  lastSyncAt?: number
}

/**
 * Extended Folder with source information
 */
export interface ExtendedFolder<T extends FileItem = FileItem> extends Folder<T> {
  sourceType: FileSourceType
  permissions: ItemPermissions
  cloudId?: string
  syncPath?: string
}

/**
 * Helper to create a successful result
 */
export function createSuccessResult<T>(data: T): ProviderResult<T> {
  return { success: true, data }
}

/**
 * Helper to create a failure result
 */
export function createFailureResult<T>(
  error: string,
  code: ProviderErrorCode = 'UNKNOWN',
): ProviderResult<T> {
  return { success: false, error, code }
}
