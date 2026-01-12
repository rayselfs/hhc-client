/**
 * Message Type Enum
 * Standardized naming: CATEGORY_ACTION
 */
export enum MessageType {
  // --- View Control ---
  /** Switch the main view component (Bible, Timer, Media) */
  VIEW_CHANGE = 'VIEW_CHANGE',
  /** Toggle projection content visibility (Mute/Unmute), showing default screen */
  PROJECTION_TOGGLE_CONTENT = 'PROJECTION_TOGGLE_CONTENT',

  // --- Timer ---
  /** [IPC] High frequency countdown update (Tick) */
  TIMER_TICK = 'TIMER_TICK',
  /** [Broadcast] Sync complete timer settings (mode, color, overtime message, etc.) */
  TIMER_SYNC_SETTINGS = 'TIMER_SYNC_SETTINGS',

  // --- Bible ---
  /** Sync Bible verse content (book, chapter, text) */
  BIBLE_SYNC_CONTENT = 'BIBLE_SYNC_CONTENT',
  /** Update Bible font size */
  BIBLE_UPDATE_FONT_SIZE = 'BIBLE_UPDATE_FONT_SIZE',

  // --- Media ---
  /** Sync media playlist and current item */
  MEDIA_UPDATE = 'MEDIA_UPDATE',
  /** Control media playback behavior (Play, Pause, Zoom) */
  MEDIA_CONTROL = 'MEDIA_CONTROL',

  // --- Global / System ---
  /** Switch application theme (Dark/Light) */
  THEME_UPDATE = 'THEME_UPDATE',
  /** Update application locale */
  LOCALE_UPDATE = 'LOCALE_UPDATE',
  /** [System] Request current full state (usually for initialization) */
  SYSTEM_GET_STATE = 'SYSTEM_GET_STATE',
  /** [System] Notification that projection window is closed */
  SYSTEM_PROJECTION_CLOSED = 'SYSTEM_PROJECTION_CLOSED',
  /** [System] Notification that no second screen is detected */
  SYSTEM_NO_SECOND_SCREEN = 'SYSTEM_NO_SECOND_SCREEN',
}

/**
 * View Type Enum
 */
export enum ViewType {
  DEFAULT = 'default',
  BIBLE = 'bible',
  TIMER = 'timer',
  MEDIA = 'media',
}

/**
 * Timer Mode Enum
 */
export enum TimerMode {
  TIMER = 'timer',
  CLOCK = 'clock',
  BOTH = 'both',
}

/**
 * Base Message Interface
 */
export interface BaseMessage {
  type: MessageType | string
  data: Record<string, unknown>
}

/**
 * View Change Message
 */
export interface ChangeViewMessage extends BaseMessage {
  type: MessageType.VIEW_CHANGE
  data: {
    view: ViewType
  }
}

/**
 * Timer Tick Message (High frequency tick)
 */
export interface TimerTickMessage extends BaseMessage {
  type: MessageType.TIMER_TICK
  data: {
    mode: TimerMode
    duration: number
    remainingTime: number
    isRunning: boolean
    progress: number
  }
}

/**
 * Timer Sync Settings Message (Broacast settings)
 */
export interface TimerSyncSettingsMessage extends BaseMessage {
  type: MessageType.TIMER_SYNC_SETTINGS
  data: {
    mode: TimerMode
    timerDuration: number
    timezone: string
    isRunning: boolean
    remainingTime: number
    formattedTime: string
    progress: number
    overtimeMessageEnabled?: boolean
    overtimeMessage?: string
    reminderEnabled?: boolean
    reminderTime?: number
  }
}

/**
 * Bible Sync Content Message
 */
export interface BibleSyncContentMessage extends BaseMessage {
  type: MessageType.BIBLE_SYNC_CONTENT
  data: {
    bookNumber: number
    chapter: number
    chapterVerses: Array<{ number: number; text: string }>
    currentVerse: number
    isMultiVersion?: boolean
    secondVersionChapterVerses?: Array<{ number: number; text: string }>
  }
}

/**
 * Bible Update Font Size Message
 */
export interface UpdateBibleFontSizeMessage extends BaseMessage {
  type: MessageType.BIBLE_UPDATE_FONT_SIZE
  data: {
    fontSize: number
  }
}

/**
 * Toggle Projection Content Message
 */
export interface ToggleProjectionContentMessage extends BaseMessage {
  type: MessageType.PROJECTION_TOGGLE_CONTENT
  data: {
    showDefault: boolean
  }
}

/**
 * Update Theme Message
 */
export interface UpdateThemeMessage extends BaseMessage {
  type: MessageType.THEME_UPDATE
  data: {
    isDark: boolean
  }
}

/**
 * Timezone Update Message - Note: This uses TIMER_SYNC_SETTINGS message type but has a different data shape (just timezone).
 * It might be better to merge this concept or keep it as a specific payload type if handled differently.
 * For now, just updating the enum.
 */
export interface TimezoneUpdateMessage extends BaseMessage {
  type: MessageType.TIMER_SYNC_SETTINGS
  data: {
    timezone: string
  }
}

/**
 * Get Current State Message
 */
export interface GetCurrentStateMessage extends BaseMessage {
  type: MessageType.SYSTEM_GET_STATE
  data: Record<string, never>
}

/**
 * Update Locale Message
 */
export interface UpdateLocaleMessage extends BaseMessage {
  type: MessageType.LOCALE_UPDATE
  data: {
    locale: string
  }
}

/**
 * 消息聯合類型
 */
export type AppMessage =
  | ChangeViewMessage
  | TimerTickMessage
  | TimerSyncSettingsMessage
  | BibleSyncContentMessage
  | UpdateBibleFontSizeMessage
  | UpdateThemeMessage
  | ToggleProjectionContentMessage
  | TimezoneUpdateMessage
  | GetCurrentStateMessage
  | UpdateLocaleMessage
  | MediaUpdateMessage
  | MediaControlMessage

/**
 * 媒體投影更新消息
 */
export interface MediaUpdateMessage extends BaseMessage {
  type: MessageType.MEDIA_UPDATE
  data: {
    playlist?: FileItem[]
    currentIndex: number
    action: 'update' | 'next' | 'prev' | 'jump' | 'ended'
    type?: 'video' | 'image' | 'pdf'
  }
}

/**
 * 媒體控制消息
 */
export interface MediaControlMessage extends BaseMessage {
  type: MessageType.MEDIA_CONTROL
  data: {
    type: 'video' | 'image' | 'pdf'
    action: string // 'play', 'pause', 'zoomIn', 'zoomOut', 'nextPage', etc.
    value?: number | string | { x: number; y: number } // zoom level, page number, pan coordinates etc.
  }
}

/**
 * 菜單項目接口
 */
export interface MenuItem {
  title: string
  icon: string
  component: ViewType
}

/**
 * 顯示器信息接口
 */
export interface DisplayInfo {
  id: number
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  internal: boolean
}

/**
 * 計時器預設接口
 */
export interface TimerPreset {
  id: string
  name: string
  duration: number
  mode: TimerMode
}

/**
 * 聖經書籍接口
 */
export interface BibleBook {
  name: string
  chapters: number
}

/**
 * 聖經章節接口
 */
export interface BibleChapter {
  book: string
  chapter: number
  verses: string[]
}

/**
 * 錯誤類型枚舉
 */
export enum ErrorType {
  ELECTRON = 'electron',
  PROJECTION = 'projection',
  API = 'api',
  NETWORK = 'network',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * 環境類型枚舉
 */
export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

/**
 * LocalStorage 鍵名枚舉
 */
export enum StorageKey {
  // App related
  PREFERRED_LANGUAGE = 'preferred-language',
  USER_PREFERENCES = 'user-preferences',
  THEME = 'theme',
  // Bible related
  SELECTED_VERSION = 'selected-version',
  SECOND_VERSION_CODE = 'second-version-code',
  VERSIONS = 'versions',
  CURRENT_FOLDER_PATH = 'current-folder-path',
  CURRENT_FOLDER = 'current-folder',
  FONT_SIZE = 'font-size',
  DARK_MODE = 'dark-mode',
  CURRENT_PASSAGE = 'current-passage',
  SEARCH_HISTORY = 'search-history',
  TEMP_STATE = 'temp-state',
  // Timer related
  TIMER_SETTINGS = 'settings',
  TIMER_PRESETS = 'presets',
}

/**
 * Storage 分類枚舉
 */
export enum StorageCategory {
  APP = 'app',
  BIBLE = 'bible',
  TIMER = 'timer',
  MEDIA = 'media',
}

/**
 * 生成完整的 LocalStorage 鍵名
 * @param category - 分類（app, bible, timer）
 * @param key - 鍵名
 * @returns 完整的 LocalStorage 鍵名
 */
export function getStorageKey(category: StorageCategory, key: StorageKey | string): string {
  return `hhc-${category}-${key}`
}

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
}

/**
 * Base interface for all folder items
 * All items in folders must implement this interface
 */
export interface FolderItem {
  id: string
  type: 'verse' | 'file' // Type discriminator for Discriminated Union
  timestamp: number // Timestamp when the item was created or last modified
  expiresAt?: number | null // Timestamp when the item should be deleted, null or undefined for permanent
  // Provider-related fields
  sourceType?: FileSourceType // Source type (local, cloud, sync)
  permissions?: ItemPermissions // Permission flags for operations
}

/**
 * File metadata for distinguishing file types (image, video, pdf, etc.)
 * Used in FileItem to identify the specific file type
 */
export interface FileMetadata {
  fileType: 'image' | 'video' | 'pdf' | 'audio' | 'document'
  width?: number // Image/Video dimensions
  height?: number // Image/Video dimensions
  duration?: number // Video/Audio duration in seconds
  thumbnailType?: 'url' | 'blob' // Added: source of the thumbnail
  thumbnailUrl?: string // Video thumbnail URL or Blob URL
  thumbnailBlobId?: string // Added: key for thumbnails store in IndexedDB
  pageCount?: number // PDF page count
  mimeType?: string // File MIME type
  [key: string]: unknown // Allow extensibility
}

/**
 * File item interface for organizing media files
 * Images, videos, PDFs, etc. are all FileItems with different metadata.fileType
 */
export interface FileItem extends FolderItem {
  type: 'file'
  name: string
  url: string
  size: number // File size in bytes
  metadata: FileMetadata
  notes?: string // User notes for presenter mode
  // Cloud/Sync provider fields (for future use)
  cloudId?: string // Cloud provider file ID (e.g., Google Drive file ID)
  syncPath?: string // Local filesystem path (for sync folders)
  lastSyncAt?: number // Last sync timestamp
}

/**
 * Verse item interface for organizing Bible verses
 * Used in history and custom folders
 * Extends FolderItem with type: 'verse'
 */
export interface VerseItem extends FolderItem {
  type: 'verse'
  bookAbbreviation: string
  bookNumber: number
  chapter: number
  verse: number
  verseText: string
}

/**
 * Generic folder interface for organizing items
 * @template TItem - The type of items in the folder (must extend FolderItem)
 */
export interface Folder<TItem extends FolderItem = FolderItem> {
  id: string
  name: string
  expanded?: boolean
  items: TItem[]
  folders: Folder<TItem>[]
  parentId?: string
  timestamp: number
  expiresAt?: number | null // Timestamp when the folder should be deleted, null for permanent
  // Provider-related fields
  sourceType?: FileSourceType // Source type (local, cloud, sync)
  permissions?: ItemPermissions // Permission flags for operations
  cloudId?: string // Cloud provider folder ID
  syncPath?: string // Local filesystem path (for sync folders)
  isLoaded?: boolean // Whether the sub-items/folders have been loaded
}

/**
 * Clipboard item definition
 */
export interface ClipboardItem<T extends FolderItem> {
  type: 'file' | 'folder'
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
