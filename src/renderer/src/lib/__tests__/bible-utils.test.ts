import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import {
  getBookConfig,
  shouldShowChapterNumber,
  getBookNameI18n,
  formatVerseReferenceShort,
  formatVerseReference,
  buildVerseHistoryItem
} from '../bible-utils'

const mockT: TFunction = ((key: string) => key) as TFunction

describe('bible-utils', () => {
  describe('getBookConfig', () => {
    it('returns book config for valid book number', () => {
      const config = getBookConfig(1)
      expect(config).toBeDefined()
      expect(config?.number).toBe(1)
      expect(config?.code).toBe('Gen')
      expect(config?.chapterCount).toBe(50)
    })

    it('returns config for book 31 (Obadiah)', () => {
      const config = getBookConfig(31)
      expect(config).toBeDefined()
      expect(config?.code).toBe('Oba')
      expect(config?.chapterCount).toBe(1)
    })

    it('returns undefined for invalid book number', () => {
      expect(getBookConfig(0)).toBeUndefined()
      expect(getBookConfig(67)).toBeUndefined()
      expect(getBookConfig(-1)).toBeUndefined()
    })

    it('returns config for book 19 (Psalms)', () => {
      const config = getBookConfig(19)
      expect(config).toBeDefined()
      expect(config?.code).toBe('Psa')
      expect(config?.chapterCount).toBe(150)
    })
  })

  describe('shouldShowChapterNumber', () => {
    it('returns true for multi-chapter books', () => {
      expect(shouldShowChapterNumber(1)).toBe(true)
      expect(shouldShowChapterNumber(19)).toBe(true)
      expect(shouldShowChapterNumber(10)).toBe(true)
    })

    it('returns false for single-chapter book (Obadiah)', () => {
      expect(shouldShowChapterNumber(31)).toBe(false)
    })

    it('returns true for invalid book number (default behavior)', () => {
      expect(shouldShowChapterNumber(0)).toBe(true)
      expect(shouldShowChapterNumber(67)).toBe(true)
      expect(shouldShowChapterNumber(-1)).toBe(true)
    })

    it('returns false for other single-chapter books', () => {
      expect(shouldShowChapterNumber(31)).toBe(false)
    })
  })

  describe('getBookNameI18n', () => {
    it('returns i18n key for valid book number', () => {
      const result = getBookNameI18n(mockT, 1)
      expect(result).toBe('bible.books.gen.name')
    })

    it('returns i18n key with lowercase book code', () => {
      const result = getBookNameI18n(mockT, 9)
      expect(result).toBe('bible.books.1sa.name')
    })

    it('returns empty string for invalid book number', () => {
      expect(getBookNameI18n(mockT, 0)).toBe('')
      expect(getBookNameI18n(mockT, 67)).toBe('')
      expect(getBookNameI18n(mockT, -1)).toBe('')
    })

    it('uses custom TFunction correctly', () => {
      const customT: TFunction = ((key: string) => `[${key}]`) as TFunction
      const result = getBookNameI18n(customT, 1)
      expect(result).toBe('[bible.books.gen.name]')
    })

    it('returns correct i18n key for Psalms (book 19)', () => {
      const result = getBookNameI18n(mockT, 19)
      expect(result).toBe('bible.books.psa.name')
    })
  })

  describe('formatVerseReferenceShort', () => {
    it('formats single verse reference', () => {
      const result = formatVerseReferenceShort(mockT, 1, 1, 1)
      expect(result).toBe('bible.books.gen.name 1:1')
    })

    it('formats verse range when verseEnd differs from verse', () => {
      const result = formatVerseReferenceShort(mockT, 1, 2, 3, 5)
      expect(result).toBe('bible.books.gen.name 2:3-5')
    })

    it('formats as single verse when verseEnd equals verse', () => {
      const result = formatVerseReferenceShort(mockT, 1, 2, 3, 3)
      expect(result).toBe('bible.books.gen.name 2:3')
    })

    it('returns empty string for invalid book number', () => {
      expect(formatVerseReferenceShort(mockT, 0, 1, 1)).toBe('')
      expect(formatVerseReferenceShort(mockT, 67, 1, 1)).toBe('')
    })

    it('handles undefined verseEnd', () => {
      const result = formatVerseReferenceShort(mockT, 1, 1, 1, undefined)
      expect(result).toBe('bible.books.gen.name 1:1')
    })

    it('formats psalm reference correctly', () => {
      const result = formatVerseReferenceShort(mockT, 19, 23, 1)
      expect(result).toBe('bible.books.psa.name 23:1')
    })
  })

  describe('formatVerseReference', () => {
    it('formats multi-chapter book with chapter and verse units', () => {
      const result = formatVerseReference(mockT, 1, 1, 1)
      expect(result).toBe('bible.books.gen.name 1bible.chapterUnit.default1bible.verseUnit')
    })

    it('formats single-chapter book (Obadiah) without chapter number', () => {
      const result = formatVerseReference(mockT, 31, 1, 5)
      expect(result).toBe('bible.books.oba.name 5bible.verseUnit')
    })

    it('returns empty string for invalid book number', () => {
      expect(formatVerseReference(mockT, 0, 1, 1)).toBe('')
      expect(formatVerseReference(mockT, 67, 1, 1)).toBe('')
    })

    it('uses psalm-specific chapter unit for book 19 (Psalms)', () => {
      const result = formatVerseReference(mockT, 19, 23, 1)
      expect(result).toBe('bible.books.psa.name 23bible.chapterUnit.psa1bible.verseUnit')
    })

    it('uses default chapter unit for non-psalm books', () => {
      const result = formatVerseReference(mockT, 2, 1, 1)
      expect(result).toBe('bible.books.exo.name 1bible.chapterUnit.default1bible.verseUnit')
    })

    it('formats with different chapter and verse numbers', () => {
      const result = formatVerseReference(mockT, 1, 5, 10)
      expect(result).toBe('bible.books.gen.name 5bible.chapterUnit.default10bible.verseUnit')
    })
  })

  describe('buildVerseHistoryItem', () => {
    it('builds verse history item with all required fields', () => {
      const params = {
        bookNumber: 1,
        bookName: 'Genesis',
        chapter: 1,
        verseNumber: 1,
        text: 'In the beginning...',
        versionCode: 'KJV',
        versionName: 'King James Version'
      }

      const result = buildVerseHistoryItem(params)

      expect(result).toEqual({
        id: 'KJV-1-1-1',
        type: 'verse',
        folderId: '',
        bookCode: 'Gen',
        bookName: 'Genesis',
        bookNumber: 1,
        chapter: 1,
        verseStart: 1,
        verseEnd: 1,
        text: 'In the beginning...',
        versionCode: 'KJV',
        versionName: 'King James Version',
        createdAt: expect.any(Number)
      })
    })

    it('generates correct id format', () => {
      const result = buildVerseHistoryItem({
        bookNumber: 19,
        bookName: 'Psalms',
        chapter: 23,
        verseNumber: 1,
        text: 'The Lord is my shepherd',
        versionCode: 'NIV',
        versionName: 'New International Version'
      })

      expect(result.id).toBe('NIV-19-23-1')
    })

    it('sets verseStart and verseEnd to the same value', () => {
      const result = buildVerseHistoryItem({
        bookNumber: 1,
        bookName: 'Genesis',
        chapter: 1,
        verseNumber: 5,
        text: 'verse text',
        versionCode: 'ESV',
        versionName: 'English Standard Version'
      })

      expect(result.verseStart).toBe(5)
      expect(result.verseEnd).toBe(5)
    })

    it('sets folderId to empty string', () => {
      const result = buildVerseHistoryItem({
        bookNumber: 1,
        bookName: 'Genesis',
        chapter: 1,
        verseNumber: 1,
        text: 'text',
        versionCode: 'KJV',
        versionName: 'KJV'
      })

      expect(result.folderId).toBe('')
    })

    it('sets type to verse', () => {
      const result = buildVerseHistoryItem({
        bookNumber: 1,
        bookName: 'Genesis',
        chapter: 1,
        verseNumber: 1,
        text: 'text',
        versionCode: 'KJV',
        versionName: 'KJV'
      })

      expect(result.type).toBe('verse')
    })

    it('handles invalid book number (bookCode becomes empty string)', () => {
      const result = buildVerseHistoryItem({
        bookNumber: 999,
        bookName: 'Unknown',
        chapter: 1,
        verseNumber: 1,
        text: 'text',
        versionCode: 'KJV',
        versionName: 'KJV'
      })

      expect(result.bookCode).toBe('')
      expect(result.id).toBe('KJV-999-1-1')
    })

    it('uses bookNumber 31 (Obadiah) correctly', () => {
      const result = buildVerseHistoryItem({
        bookNumber: 31,
        bookName: 'Obadiah',
        chapter: 1,
        verseNumber: 1,
        text: 'The vision of Obadiah',
        versionCode: 'NIV',
        versionName: 'NIV'
      })

      expect(result.bookCode).toBe('Oba')
      expect(result.id).toBe('NIV-31-1-1')
    })

    it('stores createdAt as current timestamp', () => {
      const before = Date.now()
      const result = buildVerseHistoryItem({
        bookNumber: 1,
        bookName: 'Genesis',
        chapter: 1,
        verseNumber: 1,
        text: 'text',
        versionCode: 'KJV',
        versionName: 'KJV'
      })
      const after = Date.now()

      expect(result.createdAt).toBeGreaterThanOrEqual(before)
      expect(result.createdAt).toBeLessThanOrEqual(after)
    })
  })
})
