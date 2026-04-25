import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import {
  getBookConfig,
  shouldShowChapterNumber,
  getBookNameI18n,
  formatVerseReferenceShort,
  formatVerseReference,
  buildVerseHistoryItem,
  toChineseChapterNumber
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

  describe('toChineseChapterNumber', () => {
    it('converts 1–9', () => {
      expect(toChineseChapterNumber(1)).toBe('一')
      expect(toChineseChapterNumber(5)).toBe('五')
      expect(toChineseChapterNumber(9)).toBe('九')
    })

    it('converts 10', () => {
      expect(toChineseChapterNumber(10)).toBe('十')
    })

    it('converts 11–19', () => {
      expect(toChineseChapterNumber(11)).toBe('十一')
      expect(toChineseChapterNumber(15)).toBe('十五')
      expect(toChineseChapterNumber(19)).toBe('十九')
    })

    it('keeps 20 as 二十', () => {
      expect(toChineseChapterNumber(20)).toBe('二十')
    })

    it('converts 21–29 using 廿', () => {
      expect(toChineseChapterNumber(21)).toBe('廿一')
      expect(toChineseChapterNumber(25)).toBe('廿五')
      expect(toChineseChapterNumber(29)).toBe('廿九')
    })

    it('keeps 30 as 三十', () => {
      expect(toChineseChapterNumber(30)).toBe('三十')
    })

    it('converts 31–39 using 卅', () => {
      expect(toChineseChapterNumber(31)).toBe('卅一')
      expect(toChineseChapterNumber(35)).toBe('卅五')
      expect(toChineseChapterNumber(39)).toBe('卅九')
    })

    it('converts 40–99 as standard Chinese', () => {
      expect(toChineseChapterNumber(40)).toBe('四十')
      expect(toChineseChapterNumber(50)).toBe('五十')
      expect(toChineseChapterNumber(55)).toBe('五十五')
      expect(toChineseChapterNumber(99)).toBe('九十九')
    })

    it('converts 100+ with 一百 prefix', () => {
      expect(toChineseChapterNumber(100)).toBe('一百')
      expect(toChineseChapterNumber(119)).toBe('一百十九')
      expect(toChineseChapterNumber(121)).toBe('一百廿一')
      expect(toChineseChapterNumber(130)).toBe('一百三十')
      expect(toChineseChapterNumber(139)).toBe('一百卅九')
      expect(toChineseChapterNumber(150)).toBe('一百五十')
    })
  })

  describe('buildVerseHistoryItem', () => {
    it('builds verse history item with all required fields', () => {
      const params = {
        versionId: 1,
        bookNumber: 1,
        chapter: 1,
        verseNumber: 1,
        text: 'In the beginning...'
      }

      const result = buildVerseHistoryItem(params)

      expect(result).toEqual({
        id: expect.any(String),
        type: 'verse',
        parentId: '',
        sortIndex: 0,
        versionId: 1,
        bookNumber: 1,
        chapter: 1,
        verse: 1,
        text: 'In the beginning...',
        createdAt: expect.any(Number),
        expiresAt: null
      })
    })

    it('generates UUID id', () => {
      const result = buildVerseHistoryItem({
        versionId: 2,
        bookNumber: 19,
        chapter: 23,
        verseNumber: 1,
        text: 'The Lord is my shepherd'
      })

      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('sets verse from verseNumber param', () => {
      const result = buildVerseHistoryItem({
        versionId: 3,
        bookNumber: 1,
        chapter: 1,
        verseNumber: 5,
        text: 'verse text'
      })

      expect(result.verse).toBe(5)
    })

    it('sets parentId to empty string', () => {
      const result = buildVerseHistoryItem({
        versionId: 1,
        bookNumber: 1,
        chapter: 1,
        verseNumber: 1,
        text: 'text'
      })

      expect(result.parentId).toBe('')
    })

    it('sets type to verse', () => {
      const result = buildVerseHistoryItem({
        versionId: 1,
        bookNumber: 1,
        chapter: 1,
        verseNumber: 1,
        text: 'text'
      })

      expect(result.type).toBe('verse')
    })

    it('stores versionId', () => {
      const result = buildVerseHistoryItem({
        versionId: 42,
        bookNumber: 31,
        chapter: 1,
        verseNumber: 1,
        text: 'The vision of Obadiah'
      })

      expect(result.versionId).toBe(42)
    })

    it('stores createdAt as current timestamp', () => {
      const before = Date.now()
      const result = buildVerseHistoryItem({
        versionId: 1,
        bookNumber: 1,
        chapter: 1,
        verseNumber: 1,
        text: 'text'
      })
      const after = Date.now()

      expect(result.createdAt).toBeGreaterThanOrEqual(before)
      expect(result.createdAt).toBeLessThanOrEqual(after)
    })
  })
})
