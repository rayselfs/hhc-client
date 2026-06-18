/**
 * Typed projection message contract.
 *
 * Every channel between main window ↔ projection window is defined here
 * with its exact payload type. The adapter's send() and on() are generic
 * over this map so callers get compile-time safety.
 *
 * To add a new message: add a key + payload type to the appropriate
 * interface below. send/on will accept the new channel automatically.
 */

import type { TimerTickPayload, TimerSyncPayload, StopwatchTickPayload } from './types/timer'

export interface SystemMessages {
  '__system:ready': null
  '__system:pong': null
  '__system:ping': null
  '__system:close': null
  '__system:closed': null
  '__system:blank': { showDefault: boolean }
  '__system:active-owner': { owner: string }
}

export interface AppMessages {
  /** High-frequency timer tick data for projection display */
  'timer:tick': TimerTickPayload
  /** Full timer state sync (after settings changes, on reconnect) */
  'timer:sync': TimerSyncPayload
  /** Stopwatch tick data */
  'timer:stopwatch': StopwatchTickPayload
  /** Overtime message to display on projection */
  'timer:overtime-message': { message: string }
  /** Timezone IANA string for clock display */
  'settings:timezone': { timezone: string }
  /** Timer ring color for projection display; null = use system accent color */
  'settings:timer-ring-color': { color: string | null }
  /** Bible full chapter content for projection display */
  'bible:chapter': {
    bookNumber: number
    chapter: number
    chapterVerses: Array<{ number: number; text: string }>
    currentVerse: number
    versionLocale?: string
  }
  /** Bible display settings (font size, etc.) — sent independently from verse content */
  'bible:settings': { fontSize: number }
  /** File item to display on projection (stub — coming soon) */
  'file:show': {
    itemId: string
    blobId: string
    fileName: string
    mimeType: string
    playlist: Array<{ id: string; name: string; mimeType: string }>
    currentIndex: number
    playbackMode?: 'native' | 'vlc-embedded'
    streamUrl?: string
    seekable?: boolean
    durationMs?: number
  }
  /** File playback/control actions on projection */
  'file:control': FileControlPayload
  /** File playback state reported by projection video element */
  'file:playback-state': {
    itemId: string
    currentTime: number
    duration: number
    isPlaying: boolean
    isEnded: boolean
  }
  /** Presentation ended — show end screen on projection */
  'file:end': null
}

type FileControlTarget = { itemId?: string }

export type FileControlPayload =
  | ({ action: 'play' } & FileControlTarget)
  | ({ action: 'pause' } & FileControlTarget)
  | ({ action: 'seek'; value: number } & FileControlTarget)
  | ({ action: 'volume'; value: number } & FileControlTarget)
  | { action: 'pdfPage'; value: number }
  | { action: 'pdfScroll'; value: number }
  | { action: 'pdfViewMode'; value: 'single' | 'continuous' }
  | { action: 'zoom'; value: number }
  | { action: 'pan'; value: { x: number; y: number } }

/**
 * Maps every valid channel name to its payload type.
 * Extend by adding entries to SystemMessages, AppMessages,
 * or by creating new per-feature interfaces and intersecting them here.
 */
export type ProjectionMessageMap = SystemMessages & AppMessages

export type ProjectionChannel = keyof ProjectionMessageMap

export type ProjectionPayload<C extends ProjectionChannel> = ProjectionMessageMap[C]

/**
 * Discriminated union tuple that preserves channel↔payload correlation.
 * Use this where a channel+data pair must stay matched (IPC relay, etc).
 */
export type ProjectionMessageTuple = {
  [C in ProjectionChannel]: [channel: C, data: ProjectionPayload<C>]
}[ProjectionChannel]
