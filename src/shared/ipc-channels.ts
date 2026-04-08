/**
 * Typed IPC channel contract.
 *
 * Every IPC channel between Electron main ↔ renderer is defined here
 * so that preload, main process, and renderer all agree on channel
 * names and payload shapes at compile time.
 */

import type { ProjectionChannel, ProjectionPayload } from './projection-messages'

// ---------------------------------------------------------------------------
// Invoke channels (renderer → main, returns a result)
// ---------------------------------------------------------------------------

export interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
}

export interface IpcInvokeMap {
  'projection:check': { args: []; result: { exists: boolean } }
  'projection:ensure': { args: []; result: { created: boolean } }
  'projection:close': { args: []; result: { closed: boolean } }
  'projection:get-displays': { args: []; result: DisplayInfo[] }
  'theme:get': { args: []; result: { source: string; shouldUseDarkColors: boolean } }
  'theme:set': { args: ['light' | 'dark' | 'system']; result: void }
}

export type IpcInvokeChannel = keyof IpcInvokeMap

// ---------------------------------------------------------------------------
// Send channels (renderer → main, fire-and-forget)
// ---------------------------------------------------------------------------

export interface IpcSendMap {
  'projection:send': [channel: ProjectionChannel, data: ProjectionPayload<ProjectionChannel>]
  'projection:send-to-main': [
    channel: ProjectionChannel,
    data: ProjectionPayload<ProjectionChannel>
  ]
}

export type IpcSendChannel = keyof IpcSendMap

// ---------------------------------------------------------------------------
// Main → renderer channels (main sends to renderer windows)
// ---------------------------------------------------------------------------

export interface IpcMainToRendererMap {
  'projection:message': [channel: ProjectionChannel, data: ProjectionPayload<ProjectionChannel>]
  'projection:opened': []
  'projection:closed': []
  'theme:changed': [{ shouldUseDarkColors: boolean }]
}

export type IpcMainToRendererChannel = keyof IpcMainToRendererMap
