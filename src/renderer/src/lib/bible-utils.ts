import type { BibleBookConfig } from '@shared/types/bible'
import { BIBLE_BOOKS } from '@shared/types/bible'
import type { TFunction } from 'i18next'
import type { VerseItem } from '@shared/types/folder'

type BibleBookKey = `bible.books.${string}.name`

const CN_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

export function toChineseChapterNumber(n: number): string {
  if (n >= 100) return '一百' + toChineseChapterNumber(n - 100)
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (n === 20) return '二十'
  if (n >= 21 && n <= 29) return '廿' + CN_DIGITS[units]
  if (n === 30) return '三十'
  if (n >= 31 && n <= 39) return '卅' + CN_DIGITS[units]
  if (n === 10) return '十'
  if (n >= 11 && n <= 19) return '十' + CN_DIGITS[units]
  if (tens >= 4) return CN_DIGITS[tens] + '十' + (units ? CN_DIGITS[units] : '')
  return CN_DIGITS[n]
}

export function getBookConfig(bookNumber: number): BibleBookConfig | undefined {
  return BIBLE_BOOKS.find((b) => b.number === bookNumber)
}

export function shouldShowChapterNumber(bookNumber: number): boolean {
  const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
  return book ? book.chapterCount > 1 : true
}

export function getBookNameI18n(t: TFunction, bookNumber: number): string {
  const book = getBookConfig(bookNumber)
  if (!book) return ''
  const key: BibleBookKey = `bible.books.${book.code.toLowerCase()}.name`
  return (t as (k: string) => string)(key)
}

export function formatVerseReferenceShort(
  t: TFunction,
  bookNumber: number,
  chapter: number,
  verse: number,
  verseEnd?: number
): string {
  const bookName = getBookNameI18n(t, bookNumber)
  if (!bookName) return ''
  if (verseEnd && verseEnd !== verse) {
    return `${bookName} ${chapter}:${verse}-${verseEnd}`
  }
  return `${bookName} ${chapter}:${verse}`
}

export function formatVerseReference(
  t: TFunction,
  bookNumber: number,
  chapter: number,
  verse: number,
  locale?: string
): string {
  const book = getBookConfig(bookNumber)
  if (!book) return ''
  const key: BibleBookKey = `bible.books.${book.code.toLowerCase()}.name`
  const bookName = (t as (k: string) => string)(key)
  const showChapter = shouldShowChapterNumber(bookNumber)
  const chapterUnit =
    bookNumber === 19 ? t('bible.chapterUnit.psa') : t('bible.chapterUnit.default')
  const verseUnit = t('bible.verseUnit')
  const isChinese = locale === 'zh-TW' || locale === 'zh-CN'
  if (showChapter) {
    if (isChinese && chapterUnit !== ':') {
      const chapterNumStr = toChineseChapterNumber(chapter)
      return `${bookName} ${chapterNumStr}${chapterUnit}${verse}${verseUnit}`
    }
    return `${bookName} ${chapter}${chapterUnit}${verse}${verseUnit}`
  }
  return `${bookName} ${verse}${verseUnit}`
}

export function buildVerseHistoryItem(params: {
  versionId: number
  bookNumber: number
  chapter: number
  verseNumber: number
  text: string
}): VerseItem {
  const { versionId, bookNumber, chapter, verseNumber, text } = params
  return {
    id: crypto.randomUUID(),
    type: 'verse',
    parentId: '',
    sortIndex: 0,
    versionId,
    bookNumber,
    chapter,
    verse: verseNumber,
    text,
    createdAt: Date.now(),
    expiresAt: null
  }
}
