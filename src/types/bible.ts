import type { BaseMessage } from './projection'
import { MessageType } from './projection'

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
  updated_at: number
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
 * Bible content
 */
export interface BibleContent {
  version_id: number
  version_code: string
  version_name: string
  books: BibleBook[]
  updated_at: number
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
 * Bible Book Configuration
 */
export enum BibleBookConfig {
  PSALMS = 19,
  JUDE = 65,
}

/**
 * 聖經經文段落信息
 */
export interface BiblePassage {
  bookAbbreviation: string
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

/**
 * Bible verse index item for FlexSearch
 */
export interface BibleVerseIndexItem extends Record<string, unknown> {
  verse_id: string
  version_code: string
  book_number: number
  chapter_number: number
  verse_number: number
  text: string
}

/**
 * Search index data stored in IndexedDB
 */
export interface BibleSearchIndexData {
  version_code: string
  documents_data?: BibleVerseIndexItem[]
  updated_at: number
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
