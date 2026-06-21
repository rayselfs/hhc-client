/**
 * Typed IPC channel contract.
 *
 * Every IPC channel between Electron main ↔ renderer is defined here
 * so that preload, main process, and renderer all agree on channel
 * names and payload shapes at compile time.
 */

import type { ProjectionMessageTuple } from './projection-messages'
import type {
  TimerCommand,
  TimerSettings,
  TimerState,
  StopwatchState,
  TimerTickPayload
} from './types/timer'
import type { BibleVersion, BibleBook } from './types/bible'

export type WhisperModel = 'whisper-base' | 'whisper-small' | 'whisper-medium'

export interface WhisperDownloadProgress {
  model: WhisperModel
  percent: number
  currentFile: string
  done: boolean
  error?: string
}

export interface WhisperDirInfo {
  hasFiles: boolean
}

export interface VideoPosterRequest {
  sourceFileId: string
}

export interface VideoPosterResult {
  dataUrl: string
}

export interface VideoPosterInfo {
  status: 'ready' | 'missing' | 'error'
  source?: 'bundled' | 'system'
  executableName?: string
  version?: string
  message?: string
}

export type ProjectionVlcStatus = 'ready' | 'missing' | 'error'

export interface ProjectionVlcInfo {
  status: ProjectionVlcStatus
  vlcDir?: string
  message?: string
}

export interface ProjectionVlcStartRequest {
  itemId: string
  sourceFileId: string
  container: string
  durationMs?: number
}

export interface ProjectionVlcProbeRequest {
  sourceFileId: string
}

export interface ProjectionVlcProbeResult {
  durationMs?: number
}

export type ProjectionVlcControlRequest =
  | { action: 'play'; itemId?: string }
  | { action: 'pause'; itemId?: string }
  | { action: 'seek'; itemId?: string; value: number }
  | { action: 'volume'; itemId?: string; value: number }

export interface LocalSyncConnectionInfo {
  id: string
  displayName: string
  rootName: string
  createdAt: number
  updatedAt: number
}

export interface LocalSyncRemoteItem {
  remoteItemId: string
  parentRemoteItemId: string | null
  kind: 'folder' | 'file'
  name: string
  mimeType?: string
  size?: number
  etag?: string
}

export interface LocalSyncImportFileRequest {
  connectionId: string
  remoteItemId: string
  targetFileId: string
}

export type LocalSyncWatchState =
  | 'idle'
  | 'watching'
  | 'rescan-needed'
  | 'overflow-rescan'
  | 'unavailable'

export interface LocalSyncWatchStatus {
  connectionId: string
  state: LocalSyncWatchState
  reason?: 'change' | 'rename' | 'overflow' | 'unavailable'
  updatedAt: number
}

export interface OneDriveCredentialStatus {
  hasRefreshToken: boolean
  expiresAt?: number
  scope?: string
}

export interface OneDriveAccessTokenRequest {
  connectionId: string
  clientId: string
}

export interface OneDriveAccessTokenResult {
  accessToken: string
  expiresAt?: number
  scope?: string
  tokenType?: 'Bearer'
}

export interface OneDriveAuthCodeExchangeRequest {
  clientId: string
  redirectUri: string
  code: string
  codeVerifier: string
}

export interface OneDriveConnectedAccount {
  id: string
  providerType: 'onedrive'
  displayName: string
  accountLabel?: string
}

export interface OneDriveNativeDownloadRequest {
  remoteItemId: string
  targetFileId: string
  accessToken: string
  expectedSize?: number
  mimeType?: string
}

export interface OneDriveNativeDownloadResult {
  fileId: string
  size: number
  mimeType?: string
}

export interface OneDriveAuthCallbackSession {
  callbackId: string
  redirectUri: string
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export interface DisplayInfo {
  id: number
  label: string
  isPrimary: boolean
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface IpcInvokeMap {
  'projection:check': { args: []; result: { exists: boolean } }
  'projection:ensure': { args: [string?]; result: { created: boolean } }
  'projection:move-to-display': { args: [string]; result: { moved: boolean } }
  'projection:close': { args: []; result: { closed: boolean } }
  'projection:get-displays': { args: []; result: DisplayInfo[] }
  'theme:get': { args: []; result: { source: string; shouldUseDarkColors: boolean } }
  'theme:set': { args: ['light' | 'dark' | 'system']; result: void }
  'timer:command': { args: [TimerCommand]; result: void }
  'timer:initialize': { args: [TimerSettings]; result: void }
  'timer:get-state': { args: []; result: TimerState & { stopwatch: StopwatchState } }
  'bible:get-versions': { args: []; result: BibleVersion[] }
  'bible:get-content': { args: [number]; result: BibleBook[] }
  'app:relaunch': { args: []; result: void }
  'app:clear-user-data': { args: []; result: void }
  'update:check': { args: []; result: { updateAvailable: boolean; version?: string } }
  'update:download-and-install': { args: []; result: void }
  'speech:saveKey': { args: [string, string]; result: void }
  'speech:loadKey': { args: [string]; result: string }
  'speech:deleteKey': { args: [string]; result: void }
  'app:select-directory': { args: []; result: string | null }
  'app:set-model-dir': { args: [string]; result: void }
  'app:check-whisper-dir': { args: [string]; result: WhisperDirInfo }
  'app:download-whisper-model': { args: [WhisperModel, string]; result: void }
  'native-fs:import-file': { args: [string, string]; result: { size: number } }
  'native-fs:delete-file': { args: [string]; result: void }
  'video-poster:get-info': { args: []; result: VideoPosterInfo }
  'video-poster:generate': { args: [VideoPosterRequest]; result: VideoPosterResult }
  'projection-vlc:get-info': { args: []; result: ProjectionVlcInfo }
  'projection-vlc:start': { args: [ProjectionVlcStartRequest]; result: void }
  'projection-vlc:probe': { args: [ProjectionVlcProbeRequest]; result: ProjectionVlcProbeResult }
  'projection-vlc:control': { args: [ProjectionVlcControlRequest]; result: void }
  'projection-vlc:stop': { args: []; result: void }
  'local-sync:select-folder': { args: []; result: LocalSyncConnectionInfo | null }
  'local-sync:list-folders': { args: []; result: LocalSyncConnectionInfo[] }
  'local-sync:scan-folder': { args: [string]; result: LocalSyncRemoteItem[] }
  'local-sync:import-file': { args: [LocalSyncImportFileRequest]; result: { size: number } }
  'local-sync:start-watch': { args: [string]; result: LocalSyncWatchStatus }
  'local-sync:get-watch-status': { args: [string]; result: LocalSyncWatchStatus }
  'local-sync:stop-watch': { args: [string]; result: LocalSyncWatchStatus }
  'local-sync:disconnect-folder': { args: [string]; result: void }
  'onedrive:get-credential-status': { args: [string]; result: OneDriveCredentialStatus }
  'onedrive:get-access-token': {
    args: [OneDriveAccessTokenRequest]
    result: OneDriveAccessTokenResult
  }
  'onedrive:complete-auth': {
    args: [OneDriveAuthCodeExchangeRequest]
    result: OneDriveConnectedAccount
  }
  'onedrive:delete-credentials': { args: [string]; result: void }
  'onedrive:start-auth-callback': { args: []; result: OneDriveAuthCallbackSession }
  'onedrive:wait-auth-callback': { args: [string]; result: string | null }
  'onedrive:cancel-auth-callback': { args: [string]; result: void }
  'onedrive:download-file': {
    args: [OneDriveNativeDownloadRequest]
    result: OneDriveNativeDownloadResult
  }
}

export type IpcInvokeChannel = keyof IpcInvokeMap

// ---------------------------------------------------------------------------
// Send channels (renderer → main, fire-and-forget)
// ---------------------------------------------------------------------------

export interface IpcSendMap {
  'projection:send': ProjectionMessageTuple
  'projection:send-to-main': ProjectionMessageTuple
}

export type IpcSendChannel = keyof IpcSendMap

// ---------------------------------------------------------------------------
// Main → renderer channels (main sends to renderer windows)
// ---------------------------------------------------------------------------

export interface IpcMainToRendererMap {
  'projection:message': ProjectionMessageTuple
  'projection:opened': []
  'projection:closed': []
  'theme:changed': [{ shouldUseDarkColors: boolean }]
  'timer-tick': [TimerTickPayload]
  'update:status-changed': [{ status: UpdateStatus; version?: string; error?: string }]
  'app:download-progress': [WhisperDownloadProgress]
}

export type IpcMainToRendererChannel = keyof IpcMainToRendererMap
