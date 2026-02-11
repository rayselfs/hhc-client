import type { ViewType } from './projection'

/**
 * Menu Item Interface
 */
export interface MenuItem {
  title: string
  icon: string
  component: ViewType
}

/**
 * Display Info Interface
 */
export interface DisplayInfo {
  id: number
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  internal: boolean
}

/**
 * Error Type Enum
 */
export enum ErrorType {
  ELECTRON = 'electron',
  PROJECTION = 'projection',
  API = 'api',
  NETWORK = 'network',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * Environment Type Enum
 */
export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

/**
 * LocalStorage Key Name Enum
 */
export enum StorageKey {
  // App related
  PREFERRED_LANGUAGE = 'preferred-language',
  USER_PREFERENCES = 'user-preferences',
  THEME = 'theme',
  // Bible related
  SELECTED_VERSION = 'selected-version',
  SECOND_VERSION_CODE = 'second-version-code',
  VERSIONS = 'versions',
  CURRENT_FOLDER_PATH = 'current-folder-path',
  CURRENT_FOLDER = 'current-folder',
  FONT_SIZE = 'font-size',
  DARK_MODE = 'dark-mode',
  CURRENT_PASSAGE = 'current-passage',
  SEARCH_HISTORY = 'search-history',
  TEMP_STATE = 'temp-state',
  // Timer related
  TIMER_SETTINGS = 'settings',
  TIMER_PRESETS = 'presets',
}

/**
 * Storage Category Enum
 */
export enum StorageCategory {
  APP = 'app',
  BIBLE = 'bible',
  TIMER = 'timer',
  MEDIA = 'media',
}

/**
 * Generate complete LocalStorage key name
 * @param category - Category (app, bible, timer, media)
 * @param key - Key name
 * @returns Complete LocalStorage key name
 */
export function getStorageKey(category: StorageCategory, key: StorageKey | string): string {
  return `hhc-${category}-${key}`
}
