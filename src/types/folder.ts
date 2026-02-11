import type { StorageCategory } from './common'

/**
 * File source type - distinguishes between different storage providers
 */
export type FileSourceType = 'local' | 'cloud' | 'sync'

/**
 * Permission flags for file/folder operations
 */
export interface ItemPermissions {
  canDelete: boolean
  canRename: boolean
  canMove: boolean
  canEdit: boolean
  canPresent: boolean
}

/**
 * Base interface for all folder items
 * All items in folders must implement this interface
 */
export interface FolderItem {
  id: string
  type: 'verse' | 'file'
  timestamp: number
  expiresAt?: number | null
  sortIndex?: number
  sourceType?: FileSourceType
  permissions?: ItemPermissions
}

/**
 * File metadata for distinguishing file types (image, video, pdf, etc.)
 * Used in FileItem to identify the specific file type
 */
export interface FileMetadata {
  fileType: 'image' | 'video' | 'pdf' | 'audio' | 'document'
  width?: number
  height?: number
  duration?: number
  thumbnailType?: 'url' | 'blob'
  thumbnailUrl?: string
  thumbnailBlobId?: string
  pageCount?: number
  mimeType?: string
  [key: string]: unknown
}

/**
 * File item interface for organizing media files
 * Images, videos, PDFs, etc. are all FileItems with different metadata.fileType
 */
export interface FileItem extends FolderItem {
  type: 'file'
  folderId: string
  name: string
  url: string
  size: number
  metadata: FileMetadata
  notes?: string
  cloudId?: string
  syncPath?: string
  lastSyncAt?: number
}

/**
 * Verse item interface for organizing Bible verses
 * Used in history and custom folders
 * Extends FolderItem with type: 'verse'
 */
export interface VerseItem extends FolderItem {
  type: 'verse'
  folderId: string
  bookAbbreviation: string
  bookNumber: number
  chapter: number
  verse: number
  verseText: string
}

/**
 * Sort Types
 */
export type SortBy = 'name' | 'date' | 'type' | 'custom'
export type SortOrder = 'asc' | 'desc' | 'none'

/**
 * Folder View Settings
 */
export interface FolderViewSettings {
  sortBy?: SortBy
  sortOrder?: SortOrder
  viewMode?: 'large' | 'medium' | 'small'
}

/**
 * Generic folder interface for organizing items
 */
export interface Folder<TItem extends FolderItem = FolderItem> {
  id: string
  name: string
  expanded?: boolean
  items: TItem[]
  folders: Folder<TItem>[]
  parentId?: string
  timestamp: number
  expiresAt?: number | null
  sortIndex?: number
  sourceType?: FileSourceType
  permissions?: ItemPermissions
  cloudId?: string
  syncPath?: string
  isLoaded?: boolean
  viewSettings?: FolderViewSettings
}

/**
 * Clipboard item definition
 */
export interface ClipboardItem<T extends FolderItem> {
  type: 'file' | 'folder' | 'verse'
  data: T | Folder<T>
  action: 'copy' | 'cut'
  sourceFolderId: string
}

/**
 * Configuration for folder store
 */
export interface FolderStoreConfig {
  rootId: string
  defaultRootName: string
  storageCategory: StorageCategory
}

/**
 * Folder document for IndexedDB storage (flattened, no nested items/folders)
 */
export interface FolderDocument {
  id: string
  name: string
  parentId: string | null
  expanded?: boolean
  timestamp: number
  expiresAt?: number | null
  sortIndex?: number
  sourceType?: FileSourceType
  permissions?: ItemPermissions
  viewSettings?: FolderViewSettings
  cloudId?: string
  syncPath?: string
  isLoaded?: boolean
}

/**
 * Item document union type for IndexedDB storage
 */
export type ItemDocument = FileItem | VerseItem

/**
 * Thumbnail document for IndexedDB storage
 * id = FileItem.id (1:1 relationship)
 */
export interface ThumbnailDocument {
  id: string
  blob: Blob
  createdAt?: number
}
