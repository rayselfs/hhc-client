/**
 * Application Configuration File
 * Used for managing various application settings and constants
 *
 * Naming Conventions:
 * - Constants: UPPER_CASE with underscores (CONSTANT_NAME)
 * - Category prefixes: bible-, timer-, media-, app-
 * - LocalStorage/SessionStorage: Use category prefixes
 */

// ==================== Bible Related Configuration ====================
export const BIBLE_CONFIG = {
  // Font configuration
  FONT: {
    DEFAULT_SIZE: 90,
    MIN_SIZE: 50,
    MAX_SIZE: 120,
    SIZE_STEP: 5,
  },

  // Verse configuration
  VERSE: {
    MAX_TEXT_LENGTH: 200,
    MAX_HISTORY_ITEMS: 100,
    DEFAULT_FORMAT: {
      showVerseNumber: true,
      showBookAbbreviation: true,
    },
  },

  // Folder configuration
  FOLDER: {
    HOMEPAGE_ID: 'homepage',
    MAX_DEPTH: 3,
    DEFAULT_HOMEPAGE_NAME: 'Homepage',
  },
}

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

  // UI configuration
  UI: {
    MIN_TIMER_HEIGHT: 600,
    CLOCK_BASE_SIZE: 140,
    SCREEN_BASE_WIDTH: 1920,
  },
}

// ==================== Media Related Configuration ====================
export const MEDIA_CONFIG = {
  // File configuration
  FILES: {
    MAX_THUMBNAIL_SIZE: 200,
    SUPPORTED_FORMATS: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
  },

  // Folder configuration
  FOLDERS: {
    MAX_DEPTH: 5,
    DEFAULT_ROOT_NAME: 'Root',
  },
}

// ==================== Application Configuration ====================
export const APP_CONFIG = {
  // Language configuration
  LANGUAGE: {
    DEFAULT_LOCALE: 'zh',
    SUPPORTED_LOCALES: ['zh', 'en'],
  },

  // UI configuration
  UI: {
    ANIMATION_DURATION: 200,
    CARD_HEIGHT: {
      HEADER_HEIGHT: 80,
      GAP_HEIGHT: 16,
    },
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
}

// ==================== Storage Keys Configuration ====================
export const STORAGE_KEYS = {
  // Bible related LocalStorage
  BIBLE_LOCAL: {
    SELECTED_VERSION: 'bible-selected-version',
    CUSTOM_FOLDERS: 'bible-custom-folders',
    CURRENT_FOLDER_PATH: 'bible-current-folder-path',
    CURRENT_FOLDER: 'bible-current-folder',
    FONT_SIZE: 'bible-font-size',
    DARK_MODE: 'bible-dark-mode',
  },

  // Bible related SessionStorage
  BIBLE_SESSION: {
    CURRENT_PASSAGE: 'bible-current-passage',
    SEARCH_HISTORY: 'bible-search-history',
    TEMP_STATE: 'bible-temp-state',
  },

  // Timer related LocalStorage
  TIMER_LOCAL: {
    SETTINGS: 'timer-settings',
    PRESETS: 'timer-presets',
  },

  // Media related LocalStorage
  MEDIA_LOCAL: {
    FILES: 'media-files',
    FOLDERS: 'media-folders',
  },

  // Application related LocalStorage
  APP_LOCAL: {
    PREFERRED_LANGUAGE: 'app-preferred-language',
    USER_PREFERENCES: 'app-user-preferences',
    THEME: 'app-theme',
  },
}

// ==================== Helper Functions ====================

/**
 * Get Bible related LocalStorage key
 * @param key Local storage key name
 * @returns Complete LocalStorage key
 */
export function getBibleLocalKey(key: string): string {
  return `hhc-${key}`
}

/**
 * Get Bible related SessionStorage key
 * @param key Session storage key name
 * @returns Complete SessionStorage key
 */
export function getBibleSessionKey(key: string): string {
  return `hhc-session-${key}`
}

/**
 * Get Timer related LocalStorage key
 * @param key Local storage key name
 * @returns Complete LocalStorage key
 */
export function getTimerLocalKey(key: string): string {
  return `hhc-${key}`
}

/**
 * Get Media related LocalStorage key
 * @param key Local storage key name
 * @returns Complete LocalStorage key
 */
export function getMediaLocalKey(key: string): string {
  return `hhc-${key}`
}

/**
 * Get Application related LocalStorage key
 * @param key Local storage key name
 * @returns Complete LocalStorage key
 */
export function getAppLocalKey(key: string): string {
  return `hhc-${key}`
}

/**
 * Get default font size
 * @returns Default font size
 */
export function getDefaultFontSize(): number {
  return BIBLE_CONFIG.FONT.DEFAULT_SIZE
}

/**
 * Validate if font size is within valid range
 * @param size Font size
 * @returns Whether valid
 */
export function isValidFontSize(size: number): boolean {
  return size >= BIBLE_CONFIG.FONT.MIN_SIZE && size <= BIBLE_CONFIG.FONT.MAX_SIZE
}

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
