import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectionChannel, ProjectionPayload } from '../shared/projection-messages'

interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
}

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

declare global {
  interface Window {
    electron: ElectronAPI
    api: { projection: ProjectionAPI; theme: ThemeAPI }
  }
}
