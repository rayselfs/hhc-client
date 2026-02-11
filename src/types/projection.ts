import type { TimerTickMessage, TimerSyncSettingsMessage, TimezoneUpdateMessage } from './timer'
import type { BibleSyncContentMessage, UpdateBibleFontSizeMessage } from './bible'
import type { MediaUpdateMessage, MediaControlMessage } from './media'

/**
 * Message Type Enum
 * Standardized naming: CATEGORY_ACTION
 */
export enum MessageType {
  // --- View Control ---
  /** Switch the main view component (Bible, Timer, Media) */
  VIEW_CHANGE = 'VIEW_CHANGE',
  /** Toggle projection content visibility (Mute/Unmute), showing default screen */
  PROJECTION_TOGGLE_CONTENT = 'PROJECTION_TOGGLE_CONTENT',

  // --- Timer ---
  /** [IPC] High frequency countdown update (Tick) */
  TIMER_TICK = 'TIMER_TICK',
  /** [Broadcast] Sync complete timer settings (mode, color, overtime message, etc.) */
  TIMER_SYNC_SETTINGS = 'TIMER_SYNC_SETTINGS',

  // --- Bible ---
  /** Sync Bible verse content (book, chapter, text) */
  BIBLE_SYNC_CONTENT = 'BIBLE_SYNC_CONTENT',
  /** Update Bible font size */
  BIBLE_UPDATE_FONT_SIZE = 'BIBLE_UPDATE_FONT_SIZE',

  // --- Media ---
  /** Sync media playlist and current item */
  MEDIA_UPDATE = 'MEDIA_UPDATE',
  /** Control media playback behavior (Play, Pause, Zoom) */
  MEDIA_CONTROL = 'MEDIA_CONTROL',

  // --- Global / System ---
  /** Switch application theme (Dark/Light) */
  THEME_UPDATE = 'THEME_UPDATE',
  /** Update application locale */
  LOCALE_UPDATE = 'LOCALE_UPDATE',
  /** [System] Request current full state (usually for initialization) */
  SYSTEM_GET_STATE = 'SYSTEM_GET_STATE',
  /** [System] Notification that projection window is closed */
  SYSTEM_PROJECTION_CLOSED = 'SYSTEM_PROJECTION_CLOSED',
  /** [System] Notification that no second screen is detected */
  SYSTEM_NO_SECOND_SCREEN = 'SYSTEM_NO_SECOND_SCREEN',
}

/**
 * View Type Enum
 */
export enum ViewType {
  DEFAULT = 'default',
  BIBLE = 'bible',
  TIMER = 'timer',
  MEDIA = 'media',
}

/**
 * Base Message Interface
 */
export interface BaseMessage {
  type: MessageType | string
  data: Record<string, unknown>
}

/**
 * View Change Message
 */
export interface ChangeViewMessage extends BaseMessage {
  type: MessageType.VIEW_CHANGE
  data: {
    view: ViewType
  }
}

/**
 * Toggle Projection Content Message
 */
export interface ToggleProjectionContentMessage extends BaseMessage {
  type: MessageType.PROJECTION_TOGGLE_CONTENT
  data: {
    showDefault: boolean
  }
}

/**
 * Update Theme Message
 */
export interface UpdateThemeMessage extends BaseMessage {
  type: MessageType.THEME_UPDATE
  data: {
    isDark: boolean
  }
}

/**
 * Get Current State Message
 */
export interface GetCurrentStateMessage extends BaseMessage {
  type: MessageType.SYSTEM_GET_STATE
  data: Record<string, never>
}

/**
 * Update Locale Message
 */
export interface UpdateLocaleMessage extends BaseMessage {
  type: MessageType.LOCALE_UPDATE
  data: {
    locale: string
  }
}

/**
 * Message Union Type
 */
export type AppMessage =
  | ChangeViewMessage
  | TimerTickMessage
  | TimerSyncSettingsMessage
  | BibleSyncContentMessage
  | UpdateBibleFontSizeMessage
  | UpdateThemeMessage
  | ToggleProjectionContentMessage
  | TimezoneUpdateMessage
  | GetCurrentStateMessage
  | UpdateLocaleMessage
  | MediaUpdateMessage
  | MediaControlMessage
