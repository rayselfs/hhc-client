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
}

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
