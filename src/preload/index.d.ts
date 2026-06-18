import type { ProjectionChannel, ProjectionPayload } from '../shared/projection-messages'
import type {
  DisplayInfo,
  UpdateStatus,
  WhisperModel,
  WhisperDownloadProgress,
  WhisperDirInfo,
  VideoPosterInfo,
  VideoPosterRequest,
  VideoPosterResult,
  ProjectionVlcControlRequest,
  ProjectionVlcInfo,
  ProjectionVlcProbeRequest,
  ProjectionVlcProbeResult,
  ProjectionVlcStartRequest,
  LocalSyncConnectionInfo,
  LocalSyncImportFileRequest,
  LocalSyncWatchStatus,
  LocalSyncRemoteItem,
  OneDriveCredentialInput,
  OneDriveCredentialStatus,
  OneDriveNativeDownloadRequest,
  OneDriveNativeDownloadResult
} from '../shared/ipc-channels'
import type {
  TimerCommand,
  TimerSettings,
  TimerState,
  StopwatchState,
  TimerTickPayload
} from '../shared/types/timer'
import type { BibleVersion, BibleBook } from '../shared/types/bible'

interface ThemeAPI {
  get: () => Promise<{ source: string; shouldUseDarkColors: boolean }>
  set: (theme: 'light' | 'dark' | 'system') => Promise<void>
  onChanged: (callback: (data: { shouldUseDarkColors: boolean }) => void) => () => void
}

interface ProjectionAPI {
  check: () => Promise<{ exists: boolean }>
  ensure: (displayId?: string) => Promise<{ created: boolean }>
  moveToDisplay: (displayId: string) => Promise<{ moved: boolean }>
  close: () => Promise<{ closed: boolean }>
  send: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) => void
  sendToMain: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) => void
  getDisplays: () => Promise<DisplayInfo[]>
  onProjectionMessage: (
    callback: (channel: ProjectionChannel, data: ProjectionPayload<ProjectionChannel>) => void
  ) => () => void
  onProjectionOpened: (callback: () => void) => () => void
  onProjectionClosed: (callback: () => void) => () => void
}

interface TimerAPI {
  timerCommand: (cmd: TimerCommand) => Promise<void>
  timerGetState: () => Promise<TimerState & { stopwatch: StopwatchState }>
  timerInitialize: (settings: TimerSettings) => Promise<void>
  onTimerTick: (callback: (payload: TimerTickPayload) => void) => () => void
}

interface BibleAPI {
  getVersions: () => Promise<BibleVersion[]>
  getContent: (versionId: number) => Promise<BibleBook[]>
}

interface AppAPI {
  relaunch: () => Promise<void>
  selectDirectory: () => Promise<string | null>
  setModelDir: (dir: string) => Promise<void>
  checkWhisperDir: (dir: string) => Promise<WhisperDirInfo>
  downloadWhisperModel: (model: WhisperModel, destDir: string) => Promise<void>
  onDownloadProgress: (callback: (data: WhisperDownloadProgress) => void) => () => void
}

interface UpdateAPI {
  checkForUpdates: () => Promise<{ updateAvailable: boolean; version?: string }>
  downloadAndInstall: () => Promise<void>
  onStatusChanged: (
    callback: (data: { status: UpdateStatus; version?: string; error?: string }) => void
  ) => () => void
}

interface SpeechAPI {
  saveKey: (provider: string, apiKey: string) => Promise<void>
  loadKey: (provider: string) => Promise<string>
  deleteKey: (provider: string) => Promise<void>
}

interface NativeFsAPI {
  importFile: (id: string, file: File) => Promise<{ size: number }>
  getUrl: (id: string, mimeType: string) => string
  delete: (id: string) => Promise<void>
}

interface VideoPosterAPI {
  getInfo: () => Promise<VideoPosterInfo>
  generate: (request: VideoPosterRequest) => Promise<VideoPosterResult>
}

interface ProjectionVlcAPI {
  getInfo: () => Promise<ProjectionVlcInfo>
  start: (request: ProjectionVlcStartRequest) => Promise<void>
  probe: (request: ProjectionVlcProbeRequest) => Promise<ProjectionVlcProbeResult>
  control: (command: ProjectionVlcControlRequest) => Promise<void>
  stop: () => Promise<void>
}

interface LocalSyncAPI {
  selectFolder: () => Promise<LocalSyncConnectionInfo | null>
  listFolders: () => Promise<LocalSyncConnectionInfo[]>
  scanFolder: (connectionId: string) => Promise<LocalSyncRemoteItem[]>
  importFile: (request: LocalSyncImportFileRequest) => Promise<{ size: number }>
  startWatch: (connectionId: string) => Promise<LocalSyncWatchStatus>
  getWatchStatus: (connectionId: string) => Promise<LocalSyncWatchStatus>
  stopWatch: (connectionId: string) => Promise<LocalSyncWatchStatus>
  disconnectFolder: (connectionId: string) => Promise<void>
}

interface OneDriveAPI {
  saveCredentials: (input: OneDriveCredentialInput) => Promise<OneDriveCredentialStatus>
  getCredentialStatus: (connectionId: string) => Promise<OneDriveCredentialStatus>
  deleteCredentials: (connectionId: string) => Promise<void>
  downloadFile: (request: OneDriveNativeDownloadRequest) => Promise<OneDriveNativeDownloadResult>
}

declare global {
  interface Window {
    api: {
      projection: ProjectionAPI
      theme: ThemeAPI
      timer: TimerAPI
      bible: BibleAPI
      app: AppAPI
      update: UpdateAPI
      speech: SpeechAPI
      nativeFs: NativeFsAPI
      videoPoster: VideoPosterAPI
      projectionVlc: ProjectionVlcAPI
      localSync: LocalSyncAPI
      oneDrive: OneDriveAPI
    }
  }
}
