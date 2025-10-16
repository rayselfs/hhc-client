// 統一的經文介面
export interface Verse {
  id: string
  bookName: string
  bookAbbreviation: string
  bookNumber: number
  chapter: number
  verse: number
  verseText: string
  timestamp: number
}
