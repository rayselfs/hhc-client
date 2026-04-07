import { ElectronAPI } from '@electron-toolkit/preload'

interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
}

interface ProjectionAPI {
  check: () => Promise<{ exists: boolean }>
  ensure: () => Promise<{ created: boolean }>
  close: () => Promise<{ closed: boolean }>
  send: (channel: string, data: unknown) => void
  sendToMain: (channel: string, data: unknown) => void
  getDisplays: () => Promise<DisplayInfo[]>
  onProjectionMessage: (callback: (channel: string, data: unknown) => void) => () => void
  onProjectionOpened: (callback: () => void) => () => void
  onProjectionClosed: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: { projection: ProjectionAPI }
  }
}
