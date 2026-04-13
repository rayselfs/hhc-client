import type { BibleBookConfig } from '@shared/types/bible'
import { BIBLE_BOOKS } from '@shared/types/bible'
import type { TFunction } from 'i18next'

type BibleBookKey = `bible.books.${string}.name`

export function getBookConfig(bookNumber: number): BibleBookConfig | undefined {
  return BIBLE_BOOKS.find((b) => b.number === bookNumber)
}

export function shouldShowChapterNumber(bookNumber: number): boolean {
  const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
  return book ? book.chapterCount > 1 : true
}

export function formatVerseReference(
  t: TFunction,
  bookNumber: number,
  chapter: number,
  verse: number
): string {
  const book = getBookConfig(bookNumber)
  if (!book) return ''
  const key: BibleBookKey = `bible.books.${book.code.toLowerCase()}.name`
  const bookName = (t as (k: string) => string)(key)
  const showChapter = shouldShowChapterNumber(bookNumber)
  const chapterUnit =
    bookNumber === 19 ? t('bible.chapterUnit.psa') : t('bible.chapterUnit.default')
  const verseUnit = t('bible.verseUnit')
  if (showChapter) {
    return `${bookName} ${chapter}${chapterUnit}${verse}${verseUnit}`
  }
  return `${bookName} ${verse}${verseUnit}`
}
