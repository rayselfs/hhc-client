import { describe, it, expect } from 'vitest'
import { matchBookName, getAllBookNames } from '../bible-book-matcher'

describe('matchBookName', () => {
  describe('exact matching', () => {
    it('matches zh-TW book names exactly', () => {
      const result = matchBookName('使徒行傳')
      expect(result).toEqual({
        bookNumber: 44,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('matches zh-CN book names exactly', () => {
      const result = matchBookName('使徒行传')
      expect(result).toEqual({
        bookNumber: 44,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('matches English book names exactly', () => {
      const result = matchBookName('Acts')
      expect(result).toEqual({
        bookNumber: 44,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('matches case-insensitively', () => {
      const result = matchBookName('acts')
      expect(result).toEqual({
        bookNumber: 44,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('matches with extra whitespace', () => {
      const result = matchBookName('  Acts  ')
      expect(result).toEqual({
        bookNumber: 44,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('matches multi-word English names', () => {
      const result = matchBookName('Song of Solomon')
      expect(result).toEqual({
        bookNumber: 22,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('matches numbered books', () => {
      const result = matchBookName('1 Corinthians')
      expect(result).toEqual({
        bookNumber: 46,
        confidence: 'exact',
        score: 1.0
      })
    })
  })

  describe('pinyin matching', () => {
    it('matches homophone (使徒行傳 → 使徒行轉)', () => {
      const result = matchBookName('使徒行轉')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(44)
      expect(result?.confidence).toBe('pinyin')
      expect(result?.score).toBeGreaterThan(0.75)
    })

    it('matches partial pinyin similarity', () => {
      const result = matchBookName('使途行傳')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(44)
      expect(result?.confidence).toBe('pinyin')
    })

    it('does not match below pinyin threshold', () => {
      const result = matchBookName('完全不相關', 0.75, 0.0)
      expect(result).toBeNull()
    })
  })

  describe('fuzzy matching', () => {
    it('matches with typo (使徒行传 → 使徒行传傳)', () => {
      const result = matchBookName('使徒行传傳')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(44)
      expect(result?.confidence).toBe('fuzzy')
      expect(result?.score).toBeGreaterThan(0.6)
    })

    it('matches partial English names', () => {
      const result = matchBookName('Revelation')
      expect(result).toEqual({
        bookNumber: 66,
        confidence: 'exact',
        score: 1.0
      })
    })

    it('does not match below fuzzy threshold', () => {
      const result = matchBookName('xyz', 0.99, 0.99)
      expect(result).toBeNull()
    })

    it('matches book name with prefix (substring match)', () => {
      const result = matchBookName('我今天要講使徒行傳')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(44)
      expect(result?.confidence).toBe('fuzzy')
      expect(result?.score).toBe(1.0)
    })

    it('matches book name with "請翻到" prefix', () => {
      const result = matchBookName('請翻到約翰福音')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(43)
      expect(result?.confidence).toBe('fuzzy')
      expect(result?.score).toBe(1.0)
    })

    it('matches book name with English prefix', () => {
      const result = matchBookName('Today we are reading Acts')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(44)
      expect(result?.confidence).toBe('fuzzy')
      expect(result?.score).toBe(1.0)
    })

    it('matches simplified Chinese with prefix', () => {
      const result = matchBookName('现在来看使徒行传')
      expect(result).not.toBeNull()
      expect(result?.bookNumber).toBe(44)
      expect(result?.confidence).toBe('fuzzy')
      expect(result?.score).toBe(1.0)
    })
  })

  describe('priority: exact > pinyin > fuzzy', () => {
    it('returns exact match when multiple matches possible', () => {
      const result = matchBookName('使徒行傳')
      expect(result?.confidence).toBe('exact')
      expect(result?.score).toBe(1.0)
    })
  })

  describe('all 66 books', () => {
    const allBooks = getAllBookNames()

    it('has 66 book names', () => {
      expect(allBooks).toHaveLength(66)
    })

    it('matches all zh-TW names exactly', () => {
      allBooks.forEach((book) => {
        const result = matchBookName(book.zhTW)
        expect(result).not.toBeNull()
        expect(result?.confidence).toBe('exact')
        expect(result?.score).toBe(1.0)
      })
    })

    it('matches all zh-CN names exactly', () => {
      allBooks.forEach((book) => {
        const result = matchBookName(book.zhCN)
        expect(result).not.toBeNull()
        expect(result?.confidence).toBe('exact')
        expect(result?.score).toBe(1.0)
      })
    })

    it('matches all English names exactly', () => {
      allBooks.forEach((book) => {
        const result = matchBookName(book.en)
        expect(result).not.toBeNull()
        expect(result?.confidence).toBe('exact')
        expect(result?.score).toBe(1.0)
      })
    })
  })

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(matchBookName('')).toBeNull()
    })

    it('returns null for completely unrelated text', () => {
      const result = matchBookName('這是完全不相關的文字', 0.9, 0.9)
      expect(result).toBeNull()
    })
  })
})
