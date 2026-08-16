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
import type { ProjectionTheme } from './types/projection-theme'

type EditableProjectionSlideBackground =
  | { type: 'solid'; color: string; transparency: number }
  | { type: 'color'; color: string }
  | {
      type: 'gradient'
      from: string
      to: string
      direction: 'left-right' | 'top-bottom' | 'diagonal'
    }
  | {
      type: 'gradient'
      gradientType: 'linear'
      direction: 'left-right' | 'top-bottom' | 'diagonal'
      angle: number
      stops: Array<{ color: string; position: number; transparency: number; brightness: number }>
    }

type EditableProjectionElementBase = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked?: boolean
}

type EditableProjectionTextElement = EditableProjectionElementBase & {
  type: 'text'
  autoWidth?: boolean
  autoSize?: 'content' | 'fixed'
  text: string
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
}

type EditableProjectionImageElement = EditableProjectionElementBase & {
  type: 'image'
  assetId: string
  crop?: { top: number; right: number; bottom: number; left: number }
  borderColor?: string
  borderWidth?: number
  shadow?: 'none' | 'soft' | 'medium'
}

type EditableProjectionShapeElement = EditableProjectionElementBase & {
  type: 'shape'
  shape: 'rectangle' | 'ellipse'
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

type EditableProjectionLineElement = EditableProjectionElementBase & {
  type: 'line'
  strokeColor: string
  strokeWidth: number
}

type EditableProjectionLockedElement = EditableProjectionElementBase & {
  type: 'locked'
  label: string
}

type EditableProjectionElement =
  | EditableProjectionTextElement
  | EditableProjectionImageElement
  | EditableProjectionShapeElement
  | EditableProjectionLineElement
  | EditableProjectionLockedElement

type EditableProjectionSlide = {
  id: string
  name: string
  background: EditableProjectionSlideBackground
  elementOrder: string[]
  elements: Record<string, EditableProjectionElement>
  notes: string
}

type EditableProjectionAsset = {
  id: string
  name: string
  mimeType: string
  dataUrl: string
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
  'bible:settings': {
    fontSize: number
    templateTheme?: ProjectionTheme
  }
  /** File item to display on projection */
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
    presentation?: {
      slideIndex: number
      slideCount?: number
    }
    editablePresentation?: {
      width: number
      height: number
      slide: EditableProjectionSlide
      assets: Record<string, EditableProjectionAsset>
    }
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
    playbackRate?: number
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

export type ProjectionOwner = 'timer' | 'bible' | 'media'

export type ProjectionLifecycleStatus = 'closed' | 'opening' | 'ready' | 'recovering' | 'failed'

export type ProjectionLifecycleReason =
  | 'created'
  | 'reload'
  | 'display-move'
  | 'renderer-crash'
  | 'user-close'
  | 'popup-blocked'
  | 'ready-timeout'

export interface ProjectionLifecycleEvent {
  generation: number
  status: ProjectionLifecycleStatus
  reason: ProjectionLifecycleReason
}

export interface ProjectionWindowState {
  exists: boolean
  lifecycle: ProjectionLifecycleEvent
}

export interface ProjectionFailure {
  generation: number
  reason: 'renderer-crash' | 'popup-blocked' | 'ready-timeout'
}

export interface ProjectionMediaReplayState {
  itemId: string
  positionSeconds: number
  durationSeconds: number
  isPlaying: boolean
  isEnded: boolean
  volume: number
  playbackRate?: number
  pdfPage: number
  pdfScroll: number
  pdfViewMode: 'single' | 'continuous'
  zoom: number
  pan: { x: number; y: number }
}

export interface ProjectionSessionSnapshot {
  owner: ProjectionOwner
  showDefault: boolean
  isBlackout: boolean
  timer: {
    tick: AppMessages['timer:tick'] | null
    stopwatch: AppMessages['timer:stopwatch'] | null
    overtimeMessage: AppMessages['timer:overtime-message'] | null
    timezone: AppMessages['settings:timezone'] | null
    ringColor: AppMessages['settings:timer-ring-color'] | null
  }
  bible: {
    chapter: AppMessages['bible:chapter'] | null
    settings: AppMessages['bible:settings'] | null
  }
  media: {
    show: AppMessages['file:show'] | null
    state: ProjectionMediaReplayState | null
  }
}

export type ProjectionOperationResult =
  | { ok: true; generation: number }
  | {
      ok: false
      generation: number
      reason: ProjectionFailure['reason']
    }

export interface SystemMessages {
  '__system:ready': { generation: number }
  '__system:replay': {
    generation: number
    snapshot: ProjectionSessionSnapshot
  }
  '__system:pong': null
  '__system:ping': null
  '__system:close': null
  '__system:closed': null
  '__system:blank': { showDefault: boolean }
  '__system:blackout': { enabled: boolean }
  '__system:active-owner': { owner: string }
}

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

export type ProjectionTransportTuple = {
  [C in ProjectionChannel]: [generation: number, channel: C, data: ProjectionPayload<C>]
}[ProjectionChannel]

export type ProjectionContentChannel = Exclude<
  ProjectionChannel,
  `__system:${string}` | 'file:playback-state'
>

export type ProjectionContentMessageTuple = {
  [C in ProjectionContentChannel]: [channel: C, data: ProjectionPayload<C>]
}[ProjectionContentChannel]
