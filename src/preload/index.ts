import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const projectionApi = {
  check: () => ipcRenderer.invoke('projection:check'),
  ensure: () => ipcRenderer.invoke('projection:ensure'),
  close: () => ipcRenderer.invoke('projection:close'),
  send: (channel: string, data: unknown) => ipcRenderer.send('projection:send', channel, data),
  sendToMain: (channel: string, data: unknown) =>
    ipcRenderer.send('projection:send-to-main', channel, data),
  getDisplays: () => ipcRenderer.invoke('projection:get-displays'),
  onProjectionMessage: (callback: (channel: string, data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, channel: string, data: unknown): void => {
      callback(channel, data)
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

const api = { projection: projectionApi }

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
