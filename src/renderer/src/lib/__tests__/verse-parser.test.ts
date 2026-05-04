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

  describe('Azure speech homophones (pinyin-based parsing)', () => {
    it('handles 張 as 章 (zhang homophone)', () => {
      expect(parseVerseReference('約翰福音5張3節')).toEqual({
        book: '約翰福音',
        chapter: 5,
        verse: 3
      })
    })

    it('handles 結 as 節 (jie homophone)', () => {
      expect(parseVerseReference('創世記1章1結')).toEqual({
        book: '創世記',
        chapter: 1,
        verse: 1
      })
    })

    it('handles 簡 as 節 (near-phone jian)', () => {
      expect(parseVerseReference('羅馬書3章一簡')).toEqual({
        book: '羅馬書',
        chapter: 3,
        verse: 1
      })
    })

    it('handles 集 as 節 (near-phone ji)', () => {
      expect(parseVerseReference('薩摩爾季下13章一集')).toEqual({
        book: '薩摩爾季下',
        chapter: 13,
        verse: 1
      })
    })

    it('handles 張 with no verse marker', () => {
      expect(parseVerseReference('使圖形傳6張')).toEqual({
        book: '使圖形傳',
        chapter: 6,
        verse: 1
      })
    })

    it('handles 張 + Arabic verse without marker', () => {
      expect(parseVerseReference('約翰福音5張3')).toEqual({
        book: '約翰福音',
        chapter: 5,
        verse: 3
      })
    })

    it('handles 兩 as verse number 2', () => {
      expect(parseVerseReference('立魏計3章兩節')).toEqual({
        book: '立魏計',
        chapter: 3,
        verse: 2
      })
    })

    it('handles real Azure output with prefix', () => {
      expect(parseVerseReference('然後我在這裡讀創世紀5章3節')).toEqual({
        book: '然後我在這裡讀創世記',
        chapter: 5,
        verse: 3
      })
    })

    it('handles Azure output with trailing text after verse marker', () => {
      expect(parseVerseReference('麻辣雞書3章5節來一下')).toEqual({
        book: '瑪拉基書',
        chapter: 3,
        verse: 5
      })
    })
  })

  describe('natural language prefixes', () => {
    it('parses with "我今天要講" prefix', () => {
      const result = parseVerseReference('我今天要講使徒行傳一章一節')
      expect(result).toEqual({
        book: '我今天要講使徒行傳',
        chapter: 1,
        verse: 1
      })
    })

    it('parses with "請翻到" prefix', () => {
      const result = parseVerseReference('請翻到馬太福音五章三節')
      expect(result).toEqual({
        book: '請翻到馬太福音',
        chapter: 5,
        verse: 3
      })
    })

    it('parses with "現在我們來看" prefix', () => {
      const result = parseVerseReference('現在我們來看約翰福音3章16節')
      expect(result).toEqual({
        book: '現在我們來看約翰福音',
        chapter: 3,
        verse: 16
      })
    })

    it('parses with "讓我們打開" prefix', () => {
      const result = parseVerseReference('讓我們打開詩篇23章1節')
      expect(result).toEqual({
        book: '讓我們打開詩篇',
        chapter: 23,
        verse: 1
      })
    })

    it('parses English format with prefix', () => {
      const result = parseVerseReference('Today we are reading Acts 1:1')
      expect(result).toEqual({
        book: 'Today we are reading Acts',
        chapter: 1,
        verse: 1
      })
    })

    it('parses with prefix and Chinese numerals', () => {
      const result = parseVerseReference('接下來是創世記第一章第一節')
      expect(result).toEqual({
        book: '接下來是創世記',
        chapter: 1,
        verse: 1
      })
    })

    it('handles prefix with default verse', () => {
      const result = parseVerseReference('我們來看羅馬書8章')
      expect(result).toEqual({
        book: '我們來看羅馬書',
        chapter: 8,
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

describe('speech error correction', () => {
  it('corrects 說→書 (以賽亞說 → 以賽亞書)', () => {
    const result = parseVerseReference('以賽亞說49章5節')
    expect(result).toEqual({ book: '以賽亞書', chapter: 49, verse: 5 })
  })

  it('corrects 招→章 (49招 → 49章)', () => {
    const result = parseVerseReference('以賽亞書49招5節')
    expect(result).toEqual({ book: '以賽亞書', chapter: 49, verse: 5 })
  })

  it('corrects multiple errors in one input', () => {
    const result = parseVerseReference('以賽亞說49招5結')
    expect(result).toEqual({ book: '以賽亞書', chapter: 49, verse: 5 })
  })

  it('corrects 紀→記 (創世紀 → 創世記)', () => {
    const result = parseVerseReference('創世紀1章1節')
    expect(result).toEqual({ book: '創世記', chapter: 1, verse: 1 })
  })
})

describe('verse range pattern (X Y 兩節)', () => {
  it('extracts first verse from 五六兩節', () => {
    const result = parseVerseReference('以賽亞書49章五六兩節')
    expect(result).not.toBeNull()
    expect(result!.chapter).toBe(49)
    expect(result!.verse).toBe(5)
  })

  it('extracts first verse from digit range (56兩節)', () => {
    const result = parseVerseReference('以賽亞書49章56兩節')
    expect(result).not.toBeNull()
    expect(result!.verse).toBe(5)
  })
})

describe('篇 as chapter marker', () => {
  it('parses 詩篇51篇 (篇 as chapter)', () => {
    const result = parseVerseReference('詩篇51篇')
    expect(result).toEqual({ book: '詩篇', chapter: 51, verse: 1 })
  })

  it('parses 詩篇23篇1節', () => {
    const result = parseVerseReference('詩篇23篇1節')
    expect(result).toEqual({ book: '詩篇', chapter: 23, verse: 1 })
  })

  it('corrects 十篇→詩篇 and parses', () => {
    const result = parseVerseReference('十篇51篇')
    expect(result).toEqual({ book: '詩篇', chapter: 51, verse: 1 })
  })
})

describe('no chapter marker (single-chapter books)', () => {
  it('parses 猶大書3節 → chapter=1, verse=3', () => {
    const result = parseVerseReference('猶大書3節')
    expect(result).toEqual({ book: '猶大書', chapter: 1, verse: 3 })
  })

  it('parses 猶大書第五節 → chapter=1, verse=5', () => {
    const result = parseVerseReference('猶大書第五節')
    expect(result).toEqual({ book: '猶大書', chapter: 1, verse: 5 })
  })
})
