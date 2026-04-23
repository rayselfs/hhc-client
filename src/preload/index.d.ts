import type { ProjectionChannel, ProjectionPayload } from '../shared/projection-messages'
import type { DisplayInfo, UpdateStatus } from '../shared/ipc-channels'
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
  ensure: () => Promise<{ created: boolean }>
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
}

interface UpdateAPI {
  checkForUpdates: () => Promise<{ updateAvailable: boolean; version?: string }>
  downloadAndInstall: () => Promise<void>
  onStatusChanged: (
    callback: (data: { status: UpdateStatus; version?: string; error?: string }) => void
  ) => () => void
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
    }
  }
}
