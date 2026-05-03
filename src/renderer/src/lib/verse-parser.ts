import { pinyin } from 'pinyin-pro'

export interface ParsedVerse {
  book: string
  chapter: number
  verse: number
}

// pinyin token → number value (章 "zhang" and 節 "jie" are matched separately as markers)
const PINYIN_NUMERALS: Record<string, number> = {
  yi: 1,
  er: 2,
  san: 3,
  si: 4,
  wu: 5,
  liu: 6,
  qi: 7,
  ba: 8,
  jiu: 9,
  shi: 10,
  bai: 100,
  qian: 1000,
  liang: 2
}

function isPinyinNumeral(token: string): boolean {
  return token in PINYIN_NUMERALS
}

function isDigitToken(token: string): boolean {
  return /^\d+$/.test(token)
}

function isVerseMarker(token: string): boolean {
  return token === 'jie' || token === 'ji' || token === 'jian'
}

// ["er","shi","yi"] → 21, ["liang"] → 2, ["yi","bai"] → 100
function parsePinyinNumeral(tokens: string[]): number | null {
  if (tokens.length === 0) return null

  let result = 0
  let current = 0
  let lastWasMultiplier = false

  for (const token of tokens) {
    const value = PINYIN_NUMERALS[token]
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

function collectNumberBefore(
  tokens: string[],
  endIdx: number
): { value: number; startIdx: number } | null {
  if (endIdx <= 0) return null

  let i = endIdx - 1
  const digitTokens: string[] = []
  while (i >= 0 && isDigitToken(tokens[i])) {
    digitTokens.unshift(tokens[i])
    i--
  }
  if (digitTokens.length > 0) {
    const value = parseInt(digitTokens.join(''), 10)
    if (value > 0) return { value, startIdx: i + 1 }
  }

  i = endIdx - 1
  const numeralTokens: string[] = []
  while (i >= 0 && isPinyinNumeral(tokens[i])) {
    numeralTokens.unshift(tokens[i])
    i--
  }
  if (i >= 0 && tokens[i] === 'di') {
    i--
  }
  if (numeralTokens.length > 0) {
    const value = parsePinyinNumeral(numeralTokens)
    if (value !== null && value > 0) return { value, startIdx: i + 1 }
  }

  return null
}

function collectNumberAfter(
  tokens: string[],
  startIdx: number
): { value: number; endIdx: number } | null {
  if (startIdx >= tokens.length) return null

  let i = startIdx
  const digitTokens: string[] = []
  while (i < tokens.length && isDigitToken(tokens[i])) {
    digitTokens.push(tokens[i])
    i++
  }
  if (digitTokens.length > 0) {
    const value = parseInt(digitTokens.join(''), 10)
    if (value > 0) return { value, endIdx: i }
  }

  i = startIdx
  if (i < tokens.length && tokens[i] === 'di') {
    i++
  }
  const numeralTokens: string[] = []
  while (i < tokens.length && isPinyinNumeral(tokens[i])) {
    numeralTokens.push(tokens[i])
    i++
  }
  if (numeralTokens.length > 0) {
    const value = parsePinyinNumeral(numeralTokens)
    if (value !== null && value > 0) return { value, endIdx: i }
  }

  return null
}

function parsePinyinVerse(text: string): ParsedVerse | null {
  const cleaned = text.replace(/[。，、！？.,!?；：…\s]/g, '').replace(/第/g, '')
  if (!cleaned) return null

  const tokens = pinyin(cleaned, { toneType: 'none', type: 'array' })

  const zhangIdx = tokens.indexOf('zhang')
  if (zhangIdx < 1) return null

  const chapterResult = collectNumberBefore(tokens, zhangIdx)
  if (!chapterResult) return null

  const book = cleaned.slice(0, chapterResult.startIdx).trim()
  if (!book) return null

  let verse = 1
  const afterZhang = zhangIdx + 1

  let verseMarkerIdx = -1
  for (let i = afterZhang; i < tokens.length; i++) {
    if (isVerseMarker(tokens[i])) {
      verseMarkerIdx = i
      break
    }
    if (!isDigitToken(tokens[i]) && !isPinyinNumeral(tokens[i]) && tokens[i] !== 'di') {
      break
    }
  }

  if (verseMarkerIdx > afterZhang) {
    const verseResult = collectNumberBefore(tokens, verseMarkerIdx)
    if (verseResult) verse = verseResult.value
  } else if (verseMarkerIdx === -1) {
    const verseResult = collectNumberAfter(tokens, afterZhang)
    if (verseResult) verse = verseResult.value
  }

  if (verse <= 0) return null

  return { book, chapter: chapterResult.value, verse }
}

export function parseVerseReference(text: string): ParsedVerse | null {
  if (!text) return null

  const englishMatch = text.match(/([A-Za-z\s]+)\s+(\d+)(?::(-?\d+))?/)
  if (englishMatch) {
    const book = englishMatch[1].trim()
    const chapter = parseInt(englishMatch[2], 10)
    const verse = englishMatch[3] ? parseInt(englishMatch[3], 10) : 1

    if (chapter > 0 && verse > 0) {
      return { book, chapter, verse }
    }
    return null
  }

  return parsePinyinVerse(text)
}

export function formatVerseReference(parsed: ParsedVerse, locale: string = 'zh-TW'): string {
  if (locale.startsWith('en')) {
    return `${parsed.book} ${parsed.chapter}:${parsed.verse}`
  }
  return `${parsed.book} ${parsed.chapter}:${parsed.verse}`
}
