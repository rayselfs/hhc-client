import { describe, it, expect } from 'vitest'
import { parseVerseReference, formatVerseReference, type ParsedVerse } from '../verse-parser'

describe('parseVerseReference', () => {
  describe('English format', () => {
    it('parses "Acts 1:1" format', () => {
      expect(parseVerseReference('Acts 1:1')).toEqual({
        book: 'Acts',
        chapter: 1,
        verse: 1
      })
    })

    it('parses "John 3:16" format', () => {
      expect(parseVerseReference('John 3:16')).toEqual({
        book: 'John',
        chapter: 3,
        verse: 16
      })
    })

    it('parses multi-word book names', () => {
      expect(parseVerseReference('First Corinthians 13:4')).toEqual({
        book: 'First Corinthians',
        chapter: 13,
        verse: 4
      })
    })

    it('defaults verse to 1 when missing', () => {
      expect(parseVerseReference('Acts 1')).toEqual({
        book: 'Acts',
        chapter: 1,
        verse: 1
      })
    })

    it('returns null for invalid chapter', () => {
      expect(parseVerseReference('Acts 0:1')).toBeNull()
      expect(parseVerseReference('Acts -1:1')).toBeNull()
    })

    it('returns null for invalid verse', () => {
      expect(parseVerseReference('Acts 1:0')).toBeNull()
      expect(parseVerseReference('Acts 1:-1')).toBeNull()
    })
  })

  describe('Chinese format with Arabic numerals', () => {
    it('parses "使徒行傳1章1節" format', () => {
      expect(parseVerseReference('使徒行傳1章1節')).toEqual({
        book: '使徒行傳',
        chapter: 1,
        verse: 1
      })
    })

    it('parses "約翰福音3章16節" format', () => {
      expect(parseVerseReference('約翰福音3章16節')).toEqual({
        book: '約翰福音',
        chapter: 3,
        verse: 16
      })
    })

    it('defaults verse to 1 when missing', () => {
      expect(parseVerseReference('使徒行傳1章')).toEqual({
        book: '使徒行傳',
        chapter: 1,
        verse: 1
      })
    })

    it('handles large chapter/verse numbers', () => {
      expect(parseVerseReference('詩篇119章176節')).toEqual({
        book: '詩篇',
        chapter: 119,
        verse: 176
      })
    })

    it('returns null for invalid format (missing chapter unit)', () => {
      expect(parseVerseReference('使徒行傳1')).toBeNull()
    })

    it('returns null for invalid chapter', () => {
      expect(parseVerseReference('使徒行傳0章1節')).toBeNull()
    })
  })

  describe('Chinese format with Chinese numerals', () => {
    it('parses "使徒行傳一章一節" format', () => {
      expect(parseVerseReference('使徒行傳一章一節')).toEqual({
        book: '使徒行傳',
        chapter: 1,
        verse: 1
      })
    })

    it('parses "使徒行傳第一章第一節" format (with 第 prefix)', () => {
      expect(parseVerseReference('使徒行傳第一章第一節')).toEqual({
        book: '使徒行傳',
        chapter: 1,
        verse: 1
      })
    })

    it('parses "十" as 10', () => {
      expect(parseVerseReference('約翰福音十章十節')).toEqual({
        book: '約翰福音',
        chapter: 10,
        verse: 10
      })
    })

    it('parses "十一" as 11', () => {
      expect(parseVerseReference('約翰福音十一章五節')).toEqual({
        book: '約翰福音',
        chapter: 11,
        verse: 5
      })
    })

    it('parses "二十" as 20', () => {
      expect(parseVerseReference('約翰福音二十章一節')).toEqual({
        book: '約翰福音',
        chapter: 20,
        verse: 1
      })
    })

    it('parses "二十一" as 21', () => {
      expect(parseVerseReference('約翰福音二十一章二十五節')).toEqual({
        book: '約翰福音',
        chapter: 21,
        verse: 25
      })
    })

    it('parses "一百" as 100', () => {
      expect(parseVerseReference('詩篇一百章一節')).toEqual({
        book: '詩篇',
        chapter: 100,
        verse: 1
      })
    })

    it('parses "一百二十三" as 123', () => {
      expect(parseVerseReference('詩篇一百二十三章一節')).toEqual({
        book: '詩篇',
        chapter: 123,
        verse: 1
      })
    })

    it('defaults verse to 1 when missing', () => {
      expect(parseVerseReference('使徒行傳一章')).toEqual({
        book: '使徒行傳',
        chapter: 1,
        verse: 1
      })
    })

    it('returns null for invalid format (missing chapter unit)', () => {
      expect(parseVerseReference('使徒行傳一')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseVerseReference('')).toBeNull()
    })

    it('returns null for completely invalid format', () => {
      expect(parseVerseReference('random text')).toBeNull()
    })

    it('returns null for book name only', () => {
      expect(parseVerseReference('使徒行傳')).toBeNull()
    })

    it('handles extra whitespace in English format', () => {
      expect(parseVerseReference('Acts  1:1')).toEqual({
        book: 'Acts',
        chapter: 1,
        verse: 1
      })
    })
  })
})

describe('formatVerseReference', () => {
  const verse: ParsedVerse = { book: '使徒行傳', chapter: 1, verse: 1 }

  it('formats in Chinese style by default', () => {
    expect(formatVerseReference(verse)).toBe('使徒行傳 1:1')
  })

  it('formats in Chinese style for zh-TW', () => {
    expect(formatVerseReference(verse, 'zh-TW')).toBe('使徒行傳 1:1')
  })

  it('formats in English style for en', () => {
    expect(formatVerseReference(verse, 'en')).toBe('使徒行傳 1:1')
  })

  it('formats in English style for en-US', () => {
    expect(formatVerseReference(verse, 'en-US')).toBe('使徒行傳 1:1')
  })
})
