/**
 * Typed IPC channel contract.
 *
 * Every IPC channel between Electron main ↔ renderer is defined here
 * so that preload, main process, and renderer all agree on channel
 * names and payload shapes at compile time.
 */

import type {
  ProjectionLifecycleEvent,
  ProjectionTransportTuple,
  ProjectionWindowState
} from './projection-messages'
import type { LanRemoteAck, LanRemoteCommand, LanRemoteSnapshot } from './lan-remote'
import type {
  TimerCommand,
  TimerSettings,
  TimerState,
  StopwatchState,
  TimerTickPayload
} from './types/timer'
import type { BibleVersion, BibleBook } from './types/bible'
import type { HhcSession } from './hhc-auth'

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

export type ProjectionVlcFailureCode =
  | 'runtime-missing'
  | 'binding-unavailable'
  | 'media-open-failed'
  | 'playback-failed'

export interface ProjectionVlcFailure {
  itemId?: string
  code: ProjectionVlcFailureCode
  recoverable: boolean
  message: string
}

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
  initialPositionSeconds?: number
  initialVolume?: number
  initialPlaybackState?: 'playing' | 'paused' | 'ended'
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

export interface OneDriveNativeDownloadProgress {
  targetFileId: string
  downloadedBytes: number
  downloadTotalBytes?: number
}

export interface LanRemoteStatus {
  enabled: boolean
  host: string
  port: number
}

export interface LanRemotePairingInfo {
  url: string
  secret: string
  expiresAt: number
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
  'projection:check': { args: []; result: ProjectionWindowState }
  'projection:ensure': {
    args: [string?]
    result: { created: boolean; generation: number }
  }
  'projection:move-to-display': {
    args: [string]
    result: { moved: boolean; generation: number }
  }
  'projection:retry': {
    args: []
    result: { retried: boolean; generation: number }
  }
  'projection:get-generation': { args: []; result: { generation: number } }
  'projection:bring-to-front': { args: []; result: { broughtToFront: boolean } }
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
  'app:confirm-close': { args: []; result: { closing: boolean } }
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
  'native-fs:file-exists': { args: [string]; result: boolean }
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
  'onedrive:get-auth-redirect-uri': { args: []; result: string }
  'onedrive:wait-auth-callback': { args: [string?]; result: string | null }
  'hhc-auth:begin': { args: []; result: void }
  'hhc-auth:get-access-token': { args: []; result: string | null }
  'hhc-auth:get-session': { args: []; result: HhcSession | null }
  'hhc-auth:sign-out': { args: []; result: void }
  'onedrive:download-file': {
    args: [OneDriveNativeDownloadRequest]
    result: OneDriveNativeDownloadResult
  }
  'lan-remote:start': { args: [{ host: string; port: number }]; result: LanRemoteStatus }
  'lan-remote:stop': { args: []; result: LanRemoteStatus }
  'lan-remote:get-status': { args: []; result: LanRemoteStatus }
  'lan-remote:create-pairing': { args: [string]; result: LanRemotePairingInfo }
  'lan-remote:publish-state': { args: [LanRemoteSnapshot]; result: void }
  'lan-remote:publish-ack': { args: [LanRemoteAck]; result: void }
}

export type IpcInvokeChannel = keyof IpcInvokeMap

// ---------------------------------------------------------------------------
// Send channels (renderer → main, fire-and-forget)
// ---------------------------------------------------------------------------

export interface IpcSendMap {
  'projection:send': ProjectionTransportTuple
  'projection:send-to-main': ProjectionTransportTuple
}

export type IpcSendChannel = keyof IpcSendMap

// ---------------------------------------------------------------------------
// Main → renderer channels (main sends to renderer windows)
// ---------------------------------------------------------------------------

export interface IpcMainToRendererMap {
  'projection:message': ProjectionTransportTuple
  'projection:lifecycle': [event: ProjectionLifecycleEvent]
  'projection-vlc:failure': [failure: ProjectionVlcFailure]
  'projection-vlc:started': [generation: number, itemId: string]
  'theme:changed': [{ shouldUseDarkColors: boolean }]
  'timer-tick': [TimerTickPayload]
  'update:status-changed': [{ status: UpdateStatus; version?: string; error?: string }]
  'app:download-progress': [WhisperDownloadProgress]
  'app:close-requested': []
  'onedrive:download-progress': [OneDriveNativeDownloadProgress]
  'hhc-auth:session-changed': [session: HhcSession | null]
  'lan-remote:command': [LanRemoteCommand]
}

export type IpcMainToRendererChannel = keyof IpcMainToRendererMap
