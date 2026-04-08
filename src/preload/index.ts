import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ProjectionChannel, ProjectionPayload } from '../shared/projection-messages'

const themeApi = {
  get: () =>
    ipcRenderer.invoke('theme:get') as Promise<{
      source: string
      shouldUseDarkColors: boolean
    }>,
  set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
  onChanged: (callback: (data: { shouldUseDarkColors: boolean }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { shouldUseDarkColors: boolean }
    ): void => {
      callback(data)
    }
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  }
}

const projectionApi = {
  check: () => ipcRenderer.invoke('projection:check'),
  ensure: () => ipcRenderer.invoke('projection:ensure'),
  close: () => ipcRenderer.invoke('projection:close'),
  send: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) =>
    ipcRenderer.send('projection:send', channel, data),
  sendToMain: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) =>
    ipcRenderer.send('projection:send-to-main', channel, data),
  getDisplays: () => ipcRenderer.invoke('projection:get-displays'),
  onProjectionMessage: (
    callback: (channel: ProjectionChannel, data: ProjectionPayload<ProjectionChannel>) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      channel: ProjectionChannel,
      data: ProjectionPayload<typeof channel>
    ): void => {
      callback(channel, data as ProjectionPayload<ProjectionChannel>)
    }
    ipcRenderer.on('projection:message', handler)
    return () => ipcRenderer.removeListener('projection:message', handler)
  },
  onProjectionOpened: (callback: () => void) => {
    const handler = (): void => {
      callback()
    }
    ipcRenderer.on('projection:opened', handler)
    return () => ipcRenderer.removeListener('projection:opened', handler)
  },
  onProjectionClosed: (callback: () => void) => {
    const handler = (): void => {
      callback()
    }
    ipcRenderer.on('projection:closed', handler)
    return () => ipcRenderer.removeListener('projection:closed', handler)
  }
}

const api = { projection: projectionApi, theme: themeApi }

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
