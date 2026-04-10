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
