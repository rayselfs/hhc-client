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

export interface SystemMessages {
  /** Projection window announces it is alive */
  '__system:pong': null
  /** Main window requests a liveness check */
  '__system:ping': null
  /** Main window tells projection to close itself */
  '__system:close': null
  /** Projection window announces it is about to close */
  '__system:closed': null
}

export interface AppMessages {
  /** Plain text sent to projection (demo — will be replaced by timer messages) */
  'projection:text': string
}

/**
 * Maps every valid channel name to its payload type.
 * Extend by adding entries to SystemMessages, AppMessages,
 * or by creating new per-feature interfaces and intersecting them here.
 */
export type ProjectionMessageMap = SystemMessages & AppMessages

export type ProjectionChannel = keyof ProjectionMessageMap

export type ProjectionPayload<C extends ProjectionChannel> = ProjectionMessageMap[C]
