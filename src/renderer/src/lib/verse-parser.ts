/**
 * Parse verse references from speech recognition text
 * Supports Chinese numerals, Arabic numerals, and English book names
 *
 * Examples:
 * - "使徒行傳一章一節" → { book: "使徒行傳", chapter: 1, verse: 1 }
 * - "使徒行傳1章1節" → { book: "使徒行傳", chapter: 1, verse: 1 }
 * - "使徒行傳第一章第一節" → { book: "使徒行傳", chapter: 1, verse: 1 }
 * - "Acts 1:1" → { book: "Acts", chapter: 1, verse: 1 }
 * - "使徒行傳一章" → { book: "使徒行傳", chapter: 1, verse: 1 } (default verse = 1)
 * - "使徒行傳一" → null (invalid - missing unit)
 */

export interface ParsedVerse {
  book: string
  chapter: number
  verse: number
}

// Chinese numeral mapping
const CHINESE_NUMERALS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  百: 100,
  千: 1000
}

/**
 * Convert Chinese numerals to Arabic numbers
 * Examples:
 * - "一" → 1
 * - "十" → 10
 * - "十一" → 11
 * - "二十" → 20
 * - "二十一" → 21
 * - "一百" → 100
 * - "一百二十三" → 123
 */
function parseChineseNumeral(text: string): number | null {
  if (!text) return null

  let result = 0
  let current = 0
  let lastWasMultiplier = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const value = CHINESE_NUMERALS[char]

    if (value === undefined) return null

    if (value >= 10) {
      if (current === 0) current = 1
      current *= value
      result += current
      current = 0
      lastWasMultiplier = true
    } else {
      current = value
      lastWasMultiplier = false
    }
  }

  if (!lastWasMultiplier && current > 0) {
    result += current
  }

  return result
}

/**
 * Parse verse reference from text
 * Returns null if format is invalid
 */
export function parseVerseReference(text: string): ParsedVerse | null {
  if (!text) return null

  // Try English format first: "Acts 1:1" or "Acts 1"
  const englishMatch = text.match(/^([A-Za-z\s]+)\s+(\d+)(?::(\d+))?$/)
  if (englishMatch) {
    const book = englishMatch[1].trim()
    const chapter = parseInt(englishMatch[2], 10)
    const verse = englishMatch[3] ? parseInt(englishMatch[3], 10) : 1 // Default verse = 1

    if (chapter > 0 && verse > 0) {
      return { book, chapter, verse }
    }
    return null
  }

  // Try Chinese format with Arabic numerals: "使徒行傳1章1節"
  const arabicMatch = text.match(/^(.+?)(\d+)章(?:(\d+)節)?$/)
  if (arabicMatch) {
    const book = arabicMatch[1].trim()
    const chapter = parseInt(arabicMatch[2], 10)
    const verse = arabicMatch[3] ? parseInt(arabicMatch[3], 10) : 1 // Default verse = 1

    if (book && chapter > 0 && verse > 0) {
      return { book, chapter, verse }
    }
    return null
  }

  const normalizedText = text.replace(/第/g, '')

  const chineseMatch = normalizedText.match(
    /^(.+?)([一二三四五六七八九十百千]+)章(?:([一二三四五六七八九十百千]+)節)?$/
  )
  if (chineseMatch) {
    const book = chineseMatch[1].trim()
    const chapterText = chineseMatch[2]
    const verseText = chineseMatch[3]

    const chapter = parseChineseNumeral(chapterText)
    const verse = verseText ? parseChineseNumeral(verseText) : 1

    if (book && chapter !== null && chapter > 0 && verse !== null && verse > 0) {
      return { book, chapter, verse }
    }
  }

  // Invalid format (e.g., "使徒行傳一" without chapter unit)
  return null
}

/**
 * Format parsed verse to standard display format
 */
export function formatVerseReference(parsed: ParsedVerse, locale: string = 'zh-TW'): string {
  if (locale.startsWith('en')) {
    return `${parsed.book} ${parsed.chapter}:${parsed.verse}`
  }
  return `${parsed.book} ${parsed.chapter}:${parsed.verse}`
}
