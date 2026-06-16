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

export type FfmpegConfigStatus =
  | 'not-configured'
  | 'ready'
  | 'invalid'
  | 'missing'
  | 'unsupported-version'

export interface FfmpegCapabilityInfo {
  hasH264Encoder: boolean
  hasAacEncoder: boolean
  hasMp4Muxer: boolean
}

export interface FfmpegConfigInfo {
  status: FfmpegConfigStatus
  executableName?: string
  version?: string
  capabilities?: FfmpegCapabilityInfo
  message?: string
  validatedAt?: number
}

export interface VideoTranscodeRunRequest {
  jobId: string
  sourceFileId: string
  outputFileId: string
}

export interface VideoTranscodeRunResult {
  outputFileId: string
  size: number
}

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

export interface OneDriveCredentialInput {
  connectionId: string
  accessToken?: string
  refreshToken: string
  expiresAt?: number
  scope?: string
  tokenType?: 'Bearer'
}

export interface OneDriveCredentialStatus {
  hasRefreshToken: boolean
  expiresAt?: number
  scope?: string
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

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export interface DisplayInfo {
  id: number
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
  'projection:ensure': { args: []; result: { created: boolean } }
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
  'video-transcode:get-ffmpeg-config': { args: []; result: FfmpegConfigInfo }
  'video-transcode:select-ffmpeg': { args: []; result: FfmpegConfigInfo | null }
  'video-transcode:validate-ffmpeg': { args: []; result: FfmpegConfigInfo }
  'video-transcode:remove-ffmpeg-config': { args: []; result: FfmpegConfigInfo }
  'video-transcode:run': { args: [VideoTranscodeRunRequest]; result: VideoTranscodeRunResult }
  'video-transcode:cancel': { args: [string]; result: void }
  'local-sync:select-folder': { args: []; result: LocalSyncConnectionInfo | null }
  'local-sync:list-folders': { args: []; result: LocalSyncConnectionInfo[] }
  'local-sync:scan-folder': { args: [string]; result: LocalSyncRemoteItem[] }
  'local-sync:disconnect-folder': { args: [string]; result: void }
  'onedrive:save-credentials': { args: [OneDriveCredentialInput]; result: OneDriveCredentialStatus }
  'onedrive:get-credential-status': { args: [string]; result: OneDriveCredentialStatus }
  'onedrive:delete-credentials': { args: [string]; result: void }
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
