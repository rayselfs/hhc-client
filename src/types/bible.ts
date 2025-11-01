/**
 * Bible API 類型定義
 * 對應 bible-api 的返回結構
 */

/**
 * 聖經版本列表項目
 * 對應 API: GET /api/bible/v1/versions
 */
export interface BibleVersion {
  id: number
  code: string
  name: string
}

/**
 * 聖經經文
 */
export interface BibleVerse {
  id: number
  number: number
  text: string
}

/**
 * 聖經章節
 */
export interface BibleChapter {
  id: number
  number: number
  verses: BibleVerse[]
}

/**
 * 聖經書卷
 */
export interface BibleBook {
  id: number
  number: number
  name: string
  abbreviation: string
  chapters: BibleChapter[]
}

/**
 * 完整的聖經內容
 * 對應 API: GET /api/bible/v1/version/{version_id}
 */
export interface BibleContent {
  version_id: number
  version_code: string
  version_name: string
  books: BibleBook[]
}

/**
 * Streaming 事件類型
 */
export interface StreamingEvent {
  type: 'start' | 'complete' | 'error' | 'timeout'
  message: string
  total_books?: number
}

/**
 * Streaming 進度回調函數類型
 */
export interface StreamingProgress {
  onStart?: () => void
  onBookReceived?: (book: BibleBook, bookIndex: number, totalBooks: number) => void
  onComplete?: (totalBooks: number) => void
  onError?: (error: string) => void
  onTimeout?: () => void
}

/**
 * 多功能組件使用的經文介面
 * 用於歷史記錄和自訂資料夾中的經文項目
 */
export interface MultiFunctionVerse {
  id: string
  bookAbbreviation: string
  bookNumber: number
  chapter: number
  verse: number
  verseText: string
  timestamp: number
}

/**
 * Bible Cache 配置
 */
export enum BibleCacheConfig {
  DB_NAME = 'BibleCache',
  STORE_NAME = 'bibleContent',
  DB_VERSION = 1,
}

/**
 * Bible Cache 項目接口
 */
export interface BibleCacheItem {
  versionId: number
  versionCode: string
  versionName: string
  content: BibleContent
  timestamp: number
}

/**
 * 自訂資料夾接口
 * 用於管理用戶自訂的經文資料夾結構
 */
export interface CustomFolder {
  id: string
  name: string
  expanded: boolean
  items: MultiFunctionVerse[]
  folders: CustomFolder[]
  parentId?: string
}

/**
 * 當前選中的經文段落
 */
export interface CurrentPassage {
  bookAbbreviation: string
  bookName: string
  bookNumber: number
  chapter: number
  verse: number
}
