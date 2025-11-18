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
 * Bible Cache 配置
 */
export enum BibleCacheConfig {
  DB_NAME = 'BibleDB',
  STORE_NAME = 'bibleContent',
  DB_VERSION = 1,
}

/**
 * 聖經經文段落信息
 */
export interface BiblePassage {
  bookAbbreviation: string
  bookName: string
  bookNumber: number
  chapter: number
  verse: number
  versionId?: number
}

/**
 * 預覽經文項目
 */
export interface PreviewVerse {
  number: number
  text: string
}

/**
 * 搜索結果項目（API 返回格式）
 */
export interface SearchResult {
  score: number
  verse_id: string
  version_code: string
  book_number: number
  chapter_number: number
  verse_number: number
  text: string
}

/**
 * 搜索結果顯示項目（包含書卷縮寫）
 */
export interface SearchResultDisplay extends SearchResult {
  book_abbreviation: string
}
