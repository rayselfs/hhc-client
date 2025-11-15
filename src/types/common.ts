/**
 * 通用類型定義
 */

/**
 * 消息類型枚舉
 */
export enum MessageType {
  CHANGE_VIEW = 'CHANGE_VIEW',
  TIMER_UPDATE = 'TIMER_UPDATE',
  BIBLE_UPDATE = 'BIBLE_UPDATE',
  UPDATE_TIMER = 'UPDATE_TIMER',
  UPDATE_BIBLE = 'UPDATE_BIBLE',
  UPDATE_BIBLE_FONT_SIZE = 'UPDATE_BIBLE_FONT_SIZE',
  UPDATE_THEME = 'UPDATE_THEME',
  TOGGLE_PROJECTION_CONTENT = 'TOGGLE_PROJECTION_CONTENT',
  GET_CURRENT_STATE = 'get-current-state',
  PROJECTION_CLOSED = 'projection-closed',
  NO_SECOND_SCREEN_DETECTED = 'no-second-screen-detected',
}

/**
 * 視圖類型枚舉
 */
export enum ViewType {
  BIBLE = 'bible',
  TIMER = 'timer',
}

/**
 * 計時器模式枚舉
 */
export enum TimerMode {
  TIMER = 'timer',
  CLOCK = 'clock',
  BOTH = 'both',
}

/**
 * 基礎消息接口
 */
export interface BaseMessage {
  type: MessageType | string
  data: Record<string, unknown>
}

/**
 * 視圖切換消息
 */
export interface ChangeViewMessage extends BaseMessage {
  type: MessageType.CHANGE_VIEW
  data: {
    view: ViewType
  }
}

/**
 * 計時器更新消息
 */
export interface TimerUpdateMessage extends BaseMessage {
  type: MessageType.TIMER_UPDATE
  data: {
    mode: TimerMode
    duration: number
    remainingTime: number
    isRunning: boolean
    progress: number
  }
}

/**
 * 聖經更新消息
 */
export interface BibleUpdateMessage extends BaseMessage {
  type: MessageType.BIBLE_UPDATE
  data: {
    book: string
    chapter: number
    content: string
  }
}

/**
 * 更新計時器消息
 */
export interface UpdateTimerMessage extends BaseMessage {
  type: MessageType.UPDATE_TIMER
  data: {
    mode: TimerMode
    timerDuration: number
    timezone: string
    isRunning: boolean
    remainingTime: number
    formattedTime: string
    progress: number
  }
}

/**
 * 更新聖經消息
 */
export interface UpdateBibleMessage extends BaseMessage {
  type: MessageType.UPDATE_BIBLE
  data: {
    book: string
    chapter: number
    chapterVerses: Array<{ number: number; text: string }>
    currentVerse: number
  }
}

/**
 * 更新聖經字型大小消息
 */
export interface UpdateBibleFontSizeMessage extends BaseMessage {
  type: MessageType.UPDATE_BIBLE_FONT_SIZE
  data: {
    fontSize: number
  }
}

/**
 * 切換投影內容消息
 */
export interface ToggleProjectionContentMessage extends BaseMessage {
  type: MessageType.TOGGLE_PROJECTION_CONTENT
  data: {
    showDefault: boolean
  }
}

/**
 * 更新主題消息
 */
export interface UpdateThemeMessage extends BaseMessage {
  type: MessageType.UPDATE_THEME
  data: {
    isDark: boolean
  }
}

/**
 * 時區更新消息
 */
export interface TimezoneUpdateMessage extends BaseMessage {
  type: MessageType.UPDATE_TIMER
  data: {
    timezone: string
  }
}

/**
 * 獲取當前狀態消息
 */
export interface GetCurrentStateMessage extends BaseMessage {
  type: MessageType.GET_CURRENT_STATE
  data: Record<string, never>
}

/**
 * 消息聯合類型
 */
export type AppMessage =
  | ChangeViewMessage
  | TimerUpdateMessage
  | BibleUpdateMessage
  | UpdateTimerMessage
  | UpdateBibleMessage
  | UpdateBibleFontSizeMessage
  | UpdateThemeMessage
  | ToggleProjectionContentMessage
  | TimezoneUpdateMessage
  | GetCurrentStateMessage

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
 * API 響應接口
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
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
  FOLDERS = 'folders',
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
 * Base interface for all folder items
 * All items in folders must implement this interface
 */
export interface FolderItem {
  id: string
  type: 'verse' | 'file' // Type discriminator for Discriminated Union
  timestamp: number // Timestamp when the item was created or last modified
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
  thumbnail?: string // Video thumbnail URL
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
}
