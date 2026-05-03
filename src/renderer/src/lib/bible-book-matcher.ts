import { pinyin } from 'pinyin-pro'
import { BIBLE_BOOKS, type BibleBookConfig } from '@shared/types/bible'

export interface BookMatch {
  bookNumber: number
  confidence: 'exact' | 'pinyin' | 'fuzzy'
  score: number
}

interface BookNameMap {
  code: string
  zhTW: string
  zhCN: string
  en: string
  pinyin: string
}

const BOOK_NAMES: BookNameMap[] = [
  { code: 'gen', zhTW: '創世記', zhCN: '创世记', en: 'Genesis', pinyin: '' },
  { code: 'exo', zhTW: '出埃及記', zhCN: '出埃及记', en: 'Exodus', pinyin: '' },
  { code: 'lev', zhTW: '利未記', zhCN: '利未记', en: 'Leviticus', pinyin: '' },
  { code: 'num', zhTW: '民數記', zhCN: '民数记', en: 'Numbers', pinyin: '' },
  { code: 'deu', zhTW: '申命記', zhCN: '申命记', en: 'Deuteronomy', pinyin: '' },
  { code: 'jos', zhTW: '約書亞記', zhCN: '约书亚记', en: 'Joshua', pinyin: '' },
  { code: 'jdg', zhTW: '士師記', zhCN: '士师记', en: 'Judges', pinyin: '' },
  { code: 'rut', zhTW: '路得記', zhCN: '路得记', en: 'Ruth', pinyin: '' },
  { code: '1sa', zhTW: '撒母耳記上', zhCN: '撒母耳记上', en: '1 Samuel', pinyin: '' },
  { code: '2sa', zhTW: '撒母耳記下', zhCN: '撒母耳记下', en: '2 Samuel', pinyin: '' },
  { code: '1ki', zhTW: '列王紀上', zhCN: '列王纪上', en: '1 Kings', pinyin: '' },
  { code: '2ki', zhTW: '列王紀下', zhCN: '列王纪下', en: '2 Kings', pinyin: '' },
  { code: '1ch', zhTW: '歷代志上', zhCN: '历代志上', en: '1 Chronicles', pinyin: '' },
  { code: '2ch', zhTW: '歷代志下', zhCN: '历代志下', en: '2 Chronicles', pinyin: '' },
  { code: 'ezr', zhTW: '以斯拉記', zhCN: '以斯拉记', en: 'Ezra', pinyin: '' },
  { code: 'neh', zhTW: '尼希米記', zhCN: '尼希米记', en: 'Nehemiah', pinyin: '' },
  { code: 'est', zhTW: '以斯帖記', zhCN: '以斯帖记', en: 'Esther', pinyin: '' },
  { code: 'job', zhTW: '約伯記', zhCN: '约伯记', en: 'Job', pinyin: '' },
  { code: 'psa', zhTW: '詩篇', zhCN: '诗篇', en: 'Psalms', pinyin: '' },
  { code: 'pro', zhTW: '箴言', zhCN: '箴言', en: 'Proverbs', pinyin: '' },
  { code: 'ecc', zhTW: '傳道書', zhCN: '传道书', en: 'Ecclesiastes', pinyin: '' },
  { code: 'sol', zhTW: '雅歌', zhCN: '雅歌', en: 'Song of Solomon', pinyin: '' },
  { code: 'isa', zhTW: '以賽亞書', zhCN: '以赛亚书', en: 'Isaiah', pinyin: '' },
  { code: 'jer', zhTW: '耶利米書', zhCN: '耶利米书', en: 'Jeremiah', pinyin: '' },
  { code: 'lam', zhTW: '耶利米哀歌', zhCN: '耶利米哀歌', en: 'Lamentations', pinyin: '' },
  { code: 'eze', zhTW: '以西結書', zhCN: '以西结书', en: 'Ezekiel', pinyin: '' },
  { code: 'dan', zhTW: '但以理書', zhCN: '但以理书', en: 'Daniel', pinyin: '' },
  { code: 'hos', zhTW: '何西阿書', zhCN: '何西阿书', en: 'Hosea', pinyin: '' },
  { code: 'joe', zhTW: '約珥書', zhCN: '约珥书', en: 'Joel', pinyin: '' },
  { code: 'amo', zhTW: '阿摩司書', zhCN: '阿摩司书', en: 'Amos', pinyin: '' },
  { code: 'oba', zhTW: '俄巴底亞書', zhCN: '俄巴底亚书', en: 'Obadiah', pinyin: '' },
  { code: 'jon', zhTW: '約拿書', zhCN: '约拿书', en: 'Jonah', pinyin: '' },
  { code: 'mic', zhTW: '彌迦書', zhCN: '弥迦书', en: 'Micah', pinyin: '' },
  { code: 'nah', zhTW: '那鴻書', zhCN: '那鸿书', en: 'Nahum', pinyin: '' },
  { code: 'hab', zhTW: '哈巴谷書', zhCN: '哈巴谷书', en: 'Habakkuk', pinyin: '' },
  { code: 'zep', zhTW: '西番雅書', zhCN: '西番雅书', en: 'Zephaniah', pinyin: '' },
  { code: 'hag', zhTW: '哈該書', zhCN: '哈该书', en: 'Haggai', pinyin: '' },
  { code: 'zec', zhTW: '撒迦利亞書', zhCN: '撒迦利亚书', en: 'Zechariah', pinyin: '' },
  { code: 'mal', zhTW: '瑪拉基書', zhCN: '玛拉基书', en: 'Malachi', pinyin: '' },
  { code: 'mat', zhTW: '馬太福音', zhCN: '马太福音', en: 'Matthew', pinyin: '' },
  { code: 'mar', zhTW: '馬可福音', zhCN: '马可福音', en: 'Mark', pinyin: '' },
  { code: 'luk', zhTW: '路加福音', zhCN: '路加福音', en: 'Luke', pinyin: '' },
  { code: 'joh', zhTW: '約翰福音', zhCN: '约翰福音', en: 'John', pinyin: '' },
  { code: 'act', zhTW: '使徒行傳', zhCN: '使徒行传', en: 'Acts', pinyin: '' },
  { code: 'rom', zhTW: '羅馬書', zhCN: '罗马书', en: 'Romans', pinyin: '' },
  { code: '1co', zhTW: '哥林多前書', zhCN: '哥林多前书', en: '1 Corinthians', pinyin: '' },
  { code: '2co', zhTW: '哥林多後書', zhCN: '哥林多后书', en: '2 Corinthians', pinyin: '' },
  { code: 'gal', zhTW: '加拉太書', zhCN: '加拉太书', en: 'Galatians', pinyin: '' },
  { code: 'eph', zhTW: '以弗所書', zhCN: '以弗所书', en: 'Ephesians', pinyin: '' },
  { code: 'phi', zhTW: '腓立比書', zhCN: '腓立比书', en: 'Philippians', pinyin: '' },
  { code: 'col', zhTW: '歌羅西書', zhCN: '歌罗西书', en: 'Colossians', pinyin: '' },
  {
    code: '1th',
    zhTW: '帖撒羅尼迦前書',
    zhCN: '帖撒罗尼迦前书',
    en: '1 Thessalonians',
    pinyin: ''
  },
  {
    code: '2th',
    zhTW: '帖撒羅尼迦後書',
    zhCN: '帖撒罗尼迦后书',
    en: '2 Thessalonians',
    pinyin: ''
  },
  { code: '1ti', zhTW: '提摩太前書', zhCN: '提摩太前书', en: '1 Timothy', pinyin: '' },
  { code: '2ti', zhTW: '提摩太後書', zhCN: '提摩太后书', en: '2 Timothy', pinyin: '' },
  { code: 'tit', zhTW: '提多書', zhCN: '提多书', en: 'Titus', pinyin: '' },
  { code: 'phm', zhTW: '腓利門書', zhCN: '腓利门书', en: 'Philemon', pinyin: '' },
  { code: 'heb', zhTW: '希伯來書', zhCN: '希伯来书', en: 'Hebrews', pinyin: '' },
  { code: 'jas', zhTW: '雅各書', zhCN: '雅各书', en: 'James', pinyin: '' },
  { code: '1pe', zhTW: '彼得前書', zhCN: '彼得前书', en: '1 Peter', pinyin: '' },
  { code: '2pe', zhTW: '彼得後書', zhCN: '彼得后书', en: '2 Peter', pinyin: '' },
  { code: '1jo', zhTW: '約翰一書', zhCN: '约翰一书', en: '1 John', pinyin: '' },
  { code: '2jo', zhTW: '約翰二書', zhCN: '约翰二书', en: '2 John', pinyin: '' },
  { code: '3jo', zhTW: '約翰三書', zhCN: '约翰三书', en: '3 John', pinyin: '' },
  { code: 'jud', zhTW: '猶大書', zhCN: '犹大书', en: 'Jude', pinyin: '' },
  { code: 'rev', zhTW: '啟示錄', zhCN: '启示录', en: 'Revelation', pinyin: '' }
]

function initializePinyinMap(): void {
  for (const book of BOOK_NAMES) {
    book.pinyin = pinyin(book.zhTW, { toneType: 'none', type: 'array' }).join('')
  }
}

initializePinyinMap()

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '')
}

function exactMatch(query: string): BookMatch | null {
  const normalized = normalizeText(query)

  for (let i = 0; i < BOOK_NAMES.length; i++) {
    const book = BOOK_NAMES[i]
    if (
      normalizeText(book.zhTW) === normalized ||
      normalizeText(book.zhCN) === normalized ||
      normalizeText(book.en) === normalized
    ) {
      const config = BIBLE_BOOKS.find((b) => b.code.toLowerCase() === book.code)
      if (config) {
        return { bookNumber: config.number, confidence: 'exact', score: 1.0 }
      }
    }
  }

  return null
}

function pinyinMatch(query: string, threshold: number = 0.75): BookMatch | null {
  const queryPinyin = pinyin(query, { toneType: 'none', type: 'array' }).join('')
  const normalizedQuery = normalizeText(queryPinyin)

  let bestMatch: BookMatch | null = null
  let bestScore = 0

  for (let i = 0; i < BOOK_NAMES.length; i++) {
    const book = BOOK_NAMES[i]
    const normalizedBookPinyin = normalizeText(book.pinyin)

    const similarity = calculateSimilarity(normalizedQuery, normalizedBookPinyin)
    if (similarity >= threshold && similarity > bestScore) {
      const config = BIBLE_BOOKS.find((b) => b.code.toLowerCase() === book.code)
      if (config) {
        bestScore = similarity
        bestMatch = { bookNumber: config.number, confidence: 'pinyin', score: similarity }
      }
    }
  }

  return bestMatch
}

function fuzzyMatch(query: string, threshold: number = 0.6): BookMatch | null {
  const normalized = normalizeText(query)

  let bestMatch: BookMatch | null = null
  let bestScore = 0

  for (let i = 0; i < BOOK_NAMES.length; i++) {
    const book = BOOK_NAMES[i]

    const candidates = [normalizeText(book.zhTW), normalizeText(book.zhCN), normalizeText(book.en)]

    for (const candidate of candidates) {
      if (normalized.includes(candidate)) {
        const config = BIBLE_BOOKS.find((b) => b.code.toLowerCase() === book.code)
        if (config) {
          return { bookNumber: config.number, confidence: 'fuzzy', score: 1.0 }
        }
      }
    }

    let maxSimilarity = 0
    for (const candidate of candidates) {
      const sim = slidingWindowSimilarity(normalized, candidate)
      if (sim > maxSimilarity) maxSimilarity = sim
    }

    if (maxSimilarity >= threshold && maxSimilarity > bestScore) {
      const config = BIBLE_BOOKS.find((b) => b.code.toLowerCase() === book.code)
      if (config) {
        bestScore = maxSimilarity
        bestMatch = { bookNumber: config.number, confidence: 'fuzzy', score: maxSimilarity }
      }
    }
  }

  return bestMatch
}

// Slide a window of bookName's length across query, return best Levenshtein similarity
function slidingWindowSimilarity(query: string, bookName: string): number {
  if (query.length < bookName.length) {
    return calculateLevenshteinSimilarity(query, bookName)
  }

  let best = 0
  const windowLen = bookName.length
  for (let i = 0; i <= query.length - windowLen; i++) {
    const window = query.substring(i, i + windowLen)
    const sim = calculateLevenshteinSimilarity(window, bookName)
    if (sim > best) best = sim
  }
  return best
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (!str1 || !str2) return 0.0

  let matches = 0
  const minLength = Math.min(str1.length, str2.length)

  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) {
      matches++
    }
  }

  return matches / Math.max(str1.length, str2.length)
}

function calculateLevenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[len1][len2]
}

function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (!str1 || !str2) return 0.0

  const distance = calculateLevenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)

  return 1 - distance / maxLength
}

export function matchBookName(
  query: string,
  pinyinThreshold: number = 0.75,
  fuzzyThreshold: number = 0.6
): BookMatch | null {
  if (!query) return null

  const exact = exactMatch(query)
  if (exact) return exact

  const pinyinResult = pinyinMatch(query, pinyinThreshold)
  if (pinyinResult) return pinyinResult

  return fuzzyMatch(query, fuzzyThreshold)
}

export function getBookConfig(bookNumber: number): BibleBookConfig | undefined {
  return BIBLE_BOOKS.find((b) => b.number === bookNumber)
}

export function getAllBookNames(): BookNameMap[] {
  return BOOK_NAMES
}
