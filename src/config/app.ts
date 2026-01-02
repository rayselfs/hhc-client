/**
 * Application Configuration File
 * Used for managing various application settings and constants
 *
 * Naming Conventions:
 * - Constants: UPPER_CASE with underscores (CONSTANT_NAME)
 * - Category prefixes: bible-, timer-, media-, app-
 * - LocalStorage/SessionStorage: Use category prefixes
 */

// ==================== Application Configuration ====================
export const APP_CONFIG = {
  // UI configuration
  UI: {
    ANIMATION_DURATION: 200,
    CARD_HEIGHT: {
      HEADER_HEIGHT: 80,
      GAP_HEIGHT: 16,
    },
    MIN_CARD_HEIGHT: 600,
    DRAG: {
      IMAGE_OFFSET_X: 10,
      IMAGE_OFFSET_Y: 10,
    },
  },

  // Error handling
  ERROR: {
    MESSAGES: {
      NETWORK_ERROR: 'Network connection error',
      LOAD_FAILED: 'Load failed',
      SAVE_FAILED: 'Save failed',
      INVALID_DATA: 'Invalid data',
    },
    RETRY: {
      MAX_ATTEMPTS: 3,
      DELAY: 1000,
    },
  },

  // Folder configuration
  FOLDER: {
    ROOT_ID: 'root',
    MAX_DEPTH: 3,
    DEFAULT_ROOT_NAME: 'Root',
  },
}

// ==================== Bible Related Configuration ====================
export const BIBLE_CONFIG = {
  // Font configuration
  FONT: {
    DEFAULT_SIZE: 90,
    MIN_SIZE: 30,
    MAX_SIZE: 150,
    SIZE_STEP: 5,
    DUAL_VERSION_SCALE: 0.7,
  },

  // Verse configuration
  VERSE: {
    MAX_TEXT_LENGTH: 200,
    MAX_HISTORY_ITEMS: 50,
    DEFAULT_FORMAT: {
      showVerseNumber: true,
      showBookAbbreviation: true,
    },
  },
  // Search configuration
  SEARCH: {
    DEFAULT_RESULT_LIMIT: 20,
  },
}

export interface BibleBookConfig {
  number: number
  code: string
}

/**
 * Complete list of Bible books (Old Testament + New Testament)
 * 66 books total: 39 OT + 27 NT
 */
export const BIBLE_BOOKS: BibleBookConfig[] = [
  // Old Testament (1-39)
  { number: 1, code: 'GEN' }, // Genesis
  { number: 2, code: 'EXO' }, // Exodus
  { number: 3, code: 'LEV' }, // Leviticus
  { number: 4, code: 'NUM' }, // Numbers
  { number: 5, code: 'DEU' }, // Deuteronomy
  { number: 6, code: 'JOS' }, // Joshua
  { number: 7, code: 'JDG' }, // Judges
  { number: 8, code: 'RUT' }, // Ruth
  { number: 9, code: '1SA' }, // 1 Samuel
  { number: 10, code: '2SA' }, // 2 Samuel
  { number: 11, code: '1KI' }, // 1 Kings
  { number: 12, code: '2KI' }, // 2 Kings
  { number: 13, code: '1CH' }, // 1 Chronicles
  { number: 14, code: '2CH' }, // 2 Chronicles
  { number: 15, code: 'EZR' }, // Ezra
  { number: 16, code: 'NEH' }, // Nehemiah
  { number: 17, code: 'EST' }, // Esther
  { number: 18, code: 'JOB' }, // Job
  { number: 19, code: 'PSA' }, // Psalms
  { number: 20, code: 'PRO' }, // Proverbs
  { number: 21, code: 'ECC' }, // Ecclesiastes
  { number: 22, code: 'SNG' }, // Song of Songs
  { number: 23, code: 'ISA' }, // Isaiah
  { number: 24, code: 'JER' }, // Jeremiah
  { number: 25, code: 'LAM' }, // Lamentations
  { number: 26, code: 'EZK' }, // Ezekiel
  { number: 27, code: 'DAN' }, // Daniel
  { number: 28, code: 'HOS' }, // Hosea
  { number: 29, code: 'JOL' }, // Joel
  { number: 30, code: 'AMO' }, // Amos
  { number: 31, code: 'OBA' }, // Obadiah
  { number: 32, code: 'JON' }, // Jonah
  { number: 33, code: 'MIC' }, // Micah
  { number: 34, code: 'NAH' }, // Nahum
  { number: 35, code: 'HAB' }, // Habakkuk
  { number: 36, code: 'ZEP' }, // Zephaniah
  { number: 37, code: 'HAG' }, // Haggai
  { number: 38, code: 'ZEC' }, // Zechariah
  { number: 39, code: 'MAL' }, // Malachi
  // New Testament (40-66)
  { number: 40, code: 'MAT' }, // Matthew
  { number: 41, code: 'MRK' }, // Mark
  { number: 42, code: 'LUK' }, // Luke
  { number: 43, code: 'JHN' }, // John
  { number: 44, code: 'ACT' }, // Acts
  { number: 45, code: 'ROM' }, // Romans
  { number: 46, code: '1CO' }, // 1 Corinthians
  { number: 47, code: '2CO' }, // 2 Corinthians
  { number: 48, code: 'GAL' }, // Galatians
  { number: 49, code: 'EPH' }, // Ephesians
  { number: 50, code: 'PHP' }, // Philippians
  { number: 51, code: 'COL' }, // Colossians
  { number: 52, code: '1TH' }, // 1 Thessalonians
  { number: 53, code: '2TH' }, // 2 Thessalonians
  { number: 54, code: '1TI' }, // 1 Timothy
  { number: 55, code: '2TI' }, // 2 Timothy
  { number: 56, code: 'TIT' }, // Titus
  { number: 57, code: 'PHM' }, // Philemon
  { number: 58, code: 'HEB' }, // Hebrews
  { number: 59, code: 'JAS' }, // James
  { number: 60, code: '1PE' }, // 1 Peter
  { number: 61, code: '2PE' }, // 2 Peter
  { number: 62, code: '1JN' }, // 1 John
  { number: 63, code: '2JN' }, // 2 John
  { number: 64, code: '3JN' }, // 3 John
  { number: 65, code: 'JUD' }, // Jude
  { number: 66, code: 'REV' }, // Revelation
]

// ==================== Timer Related Configuration ====================
const DEFAULT_TIMER_DURATION = 300 // 5 mins
export const TIMER_CONFIG = {
  // Default settings
  DEFAULT_SETTINGS: {
    MODE: 'timer' as const,
    TIMER_DURATION: DEFAULT_TIMER_DURATION,
    ORIGINAL_DURATION: DEFAULT_TIMER_DURATION,
    TIMEZONE: 'Asia/Taipei',
    IS_RUNNING: false,
    REMAINING_TIME: DEFAULT_TIMER_DURATION,
    PAUSED_TIME: 0,
    REMINDER_ENABLED: false,
    REMINDER_TIME: 30,
    OVERTIME_MESSAGE_ENABLED: false,
    OVERTIME_MESSAGE: '',
  },

  // Stopwatch settings
  STOPWATCH: {
    DEFAULT_ELAPSED_TIME: 0,
    DISPLAY_MODE: 'clock' as const,
    UPDATE_INTERVAL: 100, // milliseconds
  },

  // Preset limits
  PRESETS: {
    MAX_COUNT: 5,
  },

  // Overtime Message settings
  OVERTIME_MESSAGE: {
    MAX_LENGTH: 15,
  },

  // UI configuration
  UI: {
    CLOCK_BASE_SIZE: 140,
    SCREEN_BASE_WIDTH: 1920,
  },
}

// ==================== Helper Functions ====================

/**
 * Get timer default settings
 */
export function getTimerDefaultSettings() {
  return {
    mode: TIMER_CONFIG.DEFAULT_SETTINGS.MODE,
    timerDuration: TIMER_CONFIG.DEFAULT_SETTINGS.TIMER_DURATION,
    originalDuration: TIMER_CONFIG.DEFAULT_SETTINGS.ORIGINAL_DURATION,
    timezone: TIMER_CONFIG.DEFAULT_SETTINGS.TIMEZONE,
    isRunning: TIMER_CONFIG.DEFAULT_SETTINGS.IS_RUNNING,
    remainingTime: TIMER_CONFIG.DEFAULT_SETTINGS.REMAINING_TIME,
    pausedTime: TIMER_CONFIG.DEFAULT_SETTINGS.PAUSED_TIME,
    reminderEnabled: TIMER_CONFIG.DEFAULT_SETTINGS.REMINDER_ENABLED,
    reminderTime: TIMER_CONFIG.DEFAULT_SETTINGS.REMINDER_TIME,
    overtimeMessageEnabled: TIMER_CONFIG.DEFAULT_SETTINGS.OVERTIME_MESSAGE_ENABLED,
    overtimeMessage: TIMER_CONFIG.DEFAULT_SETTINGS.OVERTIME_MESSAGE,
  }
}

/**
 * Get stopwatch default settings
 */
export function getStopwatchDefaultSettings() {
  return {
    isRunning: false,
    elapsedTime: TIMER_CONFIG.STOPWATCH.DEFAULT_ELAPSED_TIME,
    displayMode: TIMER_CONFIG.STOPWATCH.DISPLAY_MODE,
  }
}
