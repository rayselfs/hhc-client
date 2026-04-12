export interface BibleVersion {
  id: string
  code: string
  name: string
  updatedAt: string
}

export interface BibleVerse {
  id: number
  number: number
  text: string
}

export interface BibleChapter {
  number: number
  verses: BibleVerse[]
}

export interface BibleBook {
  number: number
  code: string
  name: string
  abbreviation: string
  chapters: BibleChapter[]
}

export interface BibleContent {
  version: BibleVersion
  books: BibleBook[]
}

export interface BiblePassage {
  bookNumber: number
  chapter: number
  verse: number
}

export interface BibleSearchResult {
  verseId: number
  bookNumber: number
  chapter: number
  verse: number
  text: string
  bookName: string
  score?: number
}

export interface BibleBookConfig {
  number: number
  code: string
  name: string
  nameEn: string
  abbreviation: string
  chapterCount: number
}

/**
 * Complete list of Bible books (Old Testament + New Testament)
 * 66 books total: 39 OT + 27 NT
 */
export const BIBLE_BOOKS: BibleBookConfig[] = [
  // Old Testament (1-39)
  {
    number: 1,
    code: 'Gen',
    name: '創世記',
    nameEn: 'Genesis',
    abbreviation: '創',
    chapterCount: 50
  },
  {
    number: 2,
    code: 'Exo',
    name: '出埃及記',
    nameEn: 'Exodus',
    abbreviation: '出',
    chapterCount: 40
  },
  {
    number: 3,
    code: 'Lev',
    name: '利未記',
    nameEn: 'Leviticus',
    abbreviation: '利',
    chapterCount: 27
  },
  {
    number: 4,
    code: 'Num',
    name: '民數記',
    nameEn: 'Numbers',
    abbreviation: '民',
    chapterCount: 36
  },
  {
    number: 5,
    code: 'Deu',
    name: '申命記',
    nameEn: 'Deuteronomy',
    abbreviation: '申',
    chapterCount: 34
  },
  {
    number: 6,
    code: 'Jos',
    name: '約書亞記',
    nameEn: 'Joshua',
    abbreviation: '書',
    chapterCount: 24
  },
  {
    number: 7,
    code: 'Jdg',
    name: '士師記',
    nameEn: 'Judges',
    abbreviation: '士',
    chapterCount: 21
  },
  {
    number: 8,
    code: 'Rut',
    name: '路得記',
    nameEn: 'Ruth',
    abbreviation: '得',
    chapterCount: 4
  },
  {
    number: 9,
    code: '1Sa',
    name: '撒母耳記上',
    nameEn: '1 Samuel',
    abbreviation: '撒上',
    chapterCount: 31
  },
  {
    number: 10,
    code: '2Sa',
    name: '撒母耳記下',
    nameEn: '2 Samuel',
    abbreviation: '撒下',
    chapterCount: 24
  },
  {
    number: 11,
    code: '1Ki',
    name: '列王紀上',
    nameEn: '1 Kings',
    abbreviation: '王上',
    chapterCount: 22
  },
  {
    number: 12,
    code: '2Ki',
    name: '列王紀下',
    nameEn: '2 Kings',
    abbreviation: '王下',
    chapterCount: 25
  },
  {
    number: 13,
    code: '1Ch',
    name: '歷代志上',
    nameEn: '1 Chronicles',
    abbreviation: '代上',
    chapterCount: 29
  },
  {
    number: 14,
    code: '2Ch',
    name: '歷代志下',
    nameEn: '2 Chronicles',
    abbreviation: '代下',
    chapterCount: 36
  },
  {
    number: 15,
    code: 'Ezr',
    name: '以斯拉記',
    nameEn: 'Ezra',
    abbreviation: '拉',
    chapterCount: 10
  },
  {
    number: 16,
    code: 'Neh',
    name: '尼希米記',
    nameEn: 'Nehemiah',
    abbreviation: '尼',
    chapterCount: 13
  },
  {
    number: 17,
    code: 'Est',
    name: '以斯帖記',
    nameEn: 'Esther',
    abbreviation: '斯',
    chapterCount: 10
  },
  {
    number: 18,
    code: 'Job',
    name: '約伯記',
    nameEn: 'Job',
    abbreviation: '伯',
    chapterCount: 42
  },
  {
    number: 19,
    code: 'Psa',
    name: '詩篇',
    nameEn: 'Psalms',
    abbreviation: '詩',
    chapterCount: 150
  },
  {
    number: 20,
    code: 'Pro',
    name: '箴言',
    nameEn: 'Proverbs',
    abbreviation: '箴',
    chapterCount: 31
  },
  {
    number: 21,
    code: 'Ecc',
    name: '傳道書',
    nameEn: 'Ecclesiastes',
    abbreviation: '傳',
    chapterCount: 12
  },
  {
    number: 22,
    code: 'Sol',
    name: '雅歌',
    nameEn: 'Song of Solomon',
    abbreviation: '歌',
    chapterCount: 8
  },
  {
    number: 23,
    code: 'Isa',
    name: '以賽亞書',
    nameEn: 'Isaiah',
    abbreviation: '賽',
    chapterCount: 66
  },
  {
    number: 24,
    code: 'Jer',
    name: '耶利米書',
    nameEn: 'Jeremiah',
    abbreviation: '耶',
    chapterCount: 52
  },
  {
    number: 25,
    code: 'Lam',
    name: '耶利米哀歌',
    nameEn: 'Lamentations',
    abbreviation: '哀',
    chapterCount: 5
  },
  {
    number: 26,
    code: 'Eze',
    name: '以西結書',
    nameEn: 'Ezekiel',
    abbreviation: '結',
    chapterCount: 48
  },
  {
    number: 27,
    code: 'Dan',
    name: '但以理書',
    nameEn: 'Daniel',
    abbreviation: '但',
    chapterCount: 12
  },
  {
    number: 28,
    code: 'Hos',
    name: '何西阿書',
    nameEn: 'Hosea',
    abbreviation: '何',
    chapterCount: 14
  },
  {
    number: 29,
    code: 'Joe',
    name: '約珥書',
    nameEn: 'Joel',
    abbreviation: '珥',
    chapterCount: 3
  },
  {
    number: 30,
    code: 'Amo',
    name: '阿摩司書',
    nameEn: 'Amos',
    abbreviation: '摩',
    chapterCount: 9
  },
  {
    number: 31,
    code: 'Oba',
    name: '俄巴底亞書',
    nameEn: 'Obadiah',
    abbreviation: '俄',
    chapterCount: 1
  },
  {
    number: 32,
    code: 'Jon',
    name: '約拿書',
    nameEn: 'Jonah',
    abbreviation: '拿',
    chapterCount: 4
  },
  {
    number: 33,
    code: 'Mic',
    name: '彌迦書',
    nameEn: 'Micah',
    abbreviation: '彌',
    chapterCount: 7
  },
  {
    number: 34,
    code: 'Nah',
    name: '那鴻書',
    nameEn: 'Nahum',
    abbreviation: '鴻',
    chapterCount: 3
  },
  {
    number: 35,
    code: 'Hab',
    name: '哈巴谷書',
    nameEn: 'Habakkuk',
    abbreviation: '哈',
    chapterCount: 3
  },
  {
    number: 36,
    code: 'Zep',
    name: '西番雅書',
    nameEn: 'Zephaniah',
    abbreviation: '番',
    chapterCount: 3
  },
  {
    number: 37,
    code: 'Hag',
    name: '哈該書',
    nameEn: 'Haggai',
    abbreviation: '該',
    chapterCount: 2
  },
  {
    number: 38,
    code: 'Zec',
    name: '撒迦利亞書',
    nameEn: 'Zechariah',
    abbreviation: '亞',
    chapterCount: 14
  },
  {
    number: 39,
    code: 'Mal',
    name: '瑪拉基書',
    nameEn: 'Malachi',
    abbreviation: '瑪',
    chapterCount: 4
  },
  // New Testament (40-66)
  {
    number: 40,
    code: 'Mat',
    name: '馬太福音',
    nameEn: 'Matthew',
    abbreviation: '太',
    chapterCount: 28
  },
  {
    number: 41,
    code: 'Mar',
    name: '馬可福音',
    nameEn: 'Mark',
    abbreviation: '可',
    chapterCount: 16
  },
  {
    number: 42,
    code: 'Luk',
    name: '路加福音',
    nameEn: 'Luke',
    abbreviation: '路',
    chapterCount: 24
  },
  {
    number: 43,
    code: 'Joh',
    name: '約翰福音',
    nameEn: 'John',
    abbreviation: '約',
    chapterCount: 21
  },
  {
    number: 44,
    code: 'Act',
    name: '使徒行傳',
    nameEn: 'Acts',
    abbreviation: '徒',
    chapterCount: 28
  },
  {
    number: 45,
    code: 'Rom',
    name: '羅馬書',
    nameEn: 'Romans',
    abbreviation: '羅',
    chapterCount: 16
  },
  {
    number: 46,
    code: '1Co',
    name: '哥林多前書',
    nameEn: '1 Corinthians',
    abbreviation: '林前',
    chapterCount: 16
  },
  {
    number: 47,
    code: '2Co',
    name: '哥林多後書',
    nameEn: '2 Corinthians',
    abbreviation: '林後',
    chapterCount: 13
  },
  {
    number: 48,
    code: 'Gal',
    name: '加拉太書',
    nameEn: 'Galatians',
    abbreviation: '加',
    chapterCount: 6
  },
  {
    number: 49,
    code: 'Eph',
    name: '以弗所書',
    nameEn: 'Ephesians',
    abbreviation: '弗',
    chapterCount: 6
  },
  {
    number: 50,
    code: 'Phi',
    name: '腓立比書',
    nameEn: 'Philippians',
    abbreviation: '腓',
    chapterCount: 4
  },
  {
    number: 51,
    code: 'Col',
    name: '歌羅西書',
    nameEn: 'Colossians',
    abbreviation: '西',
    chapterCount: 4
  },
  {
    number: 52,
    code: '1Th',
    name: '帖撒羅尼迦前書',
    nameEn: '1 Thessalonians',
    abbreviation: '帖前',
    chapterCount: 5
  },
  {
    number: 53,
    code: '2Th',
    name: '帖撒羅尼迦後書',
    nameEn: '2 Thessalonians',
    abbreviation: '帖後',
    chapterCount: 3
  },
  {
    number: 54,
    code: '1Ti',
    name: '提摩太前書',
    nameEn: '1 Timothy',
    abbreviation: '提前',
    chapterCount: 6
  },
  {
    number: 55,
    code: '2Ti',
    name: '提摩太後書',
    nameEn: '2 Timothy',
    abbreviation: '提後',
    chapterCount: 4
  },
  {
    number: 56,
    code: 'Tit',
    name: '提多書',
    nameEn: 'Titus',
    abbreviation: '多',
    chapterCount: 3
  },
  {
    number: 57,
    code: 'Phm',
    name: '腓利門書',
    nameEn: 'Philemon',
    abbreviation: '門',
    chapterCount: 1
  },
  {
    number: 58,
    code: 'Heb',
    name: '希伯來書',
    nameEn: 'Hebrews',
    abbreviation: '來',
    chapterCount: 13
  },
  {
    number: 59,
    code: 'Jas',
    name: '雅各書',
    nameEn: 'James',
    abbreviation: '雅',
    chapterCount: 5
  },
  {
    number: 60,
    code: '1Pe',
    name: '彼得前書',
    nameEn: '1 Peter',
    abbreviation: '彼前',
    chapterCount: 5
  },
  {
    number: 61,
    code: '2Pe',
    name: '彼得後書',
    nameEn: '2 Peter',
    abbreviation: '彼後',
    chapterCount: 3
  },
  {
    number: 62,
    code: '1Jo',
    name: '約翰一書',
    nameEn: '1 John',
    abbreviation: '約壹',
    chapterCount: 5
  },
  {
    number: 63,
    code: '2Jo',
    name: '約翰二書',
    nameEn: '2 John',
    abbreviation: '約貳',
    chapterCount: 1
  },
  {
    number: 64,
    code: '3Jo',
    name: '約翰三書',
    nameEn: '3 John',
    abbreviation: '約參',
    chapterCount: 1
  },
  {
    number: 65,
    code: 'Jud',
    name: '猶大書',
    nameEn: 'Jude',
    abbreviation: '猶',
    chapterCount: 1
  },
  {
    number: 66,
    code: 'Rev',
    name: '啟示錄',
    nameEn: 'Revelation',
    abbreviation: '啟',
    chapterCount: 22
  }
]

export const BIBLE_CONFIG = {
  maxHistoryItems: 50,
  defaultFontSize: 90,
  minFontSize: 30,
  maxFontSize: 150,
  searchDebounceMs: 200,
  apiBaseUrl: 'https://www.alive.org.tw/api/bible/v1',
  fetchTimeoutMs: 30000
}

/**
 * Get display unit for chapter numbers
 * Returns '篇' for Psalms (book 19), '章' for other books
 */
export function getBookDisplayChapter(bookNumber: number): string {
  return bookNumber === 19 ? '篇' : '章'
}

/**
 * Check if chapter number should be displayed
 * Returns false for single-chapter books like Jude (book 65)
 */
export function shouldShowChapterNumber(bookNumber: number): boolean {
  const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
  return book ? book.chapterCount > 1 : true
}

/**
 * Format a verse reference into display string
 * Example: '創世記 1:1' or '馬太福音 1:1'
 */
export function formatVerseReference(
  bookName: string,
  bookNumber: number,
  chapter: number,
  verse: number
): string {
  const displayChapter = getBookDisplayChapter(bookNumber)
  const showChapter = shouldShowChapterNumber(bookNumber)

  if (showChapter) {
    return `${bookName} ${chapter}${displayChapter}${verse}節`
  }
  return `${bookName} ${verse}節`
}
