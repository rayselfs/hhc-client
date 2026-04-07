import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const projectionApi = {
  check: () => ipcRenderer.invoke('projection:check'),
  ensure: () => ipcRenderer.invoke('projection:ensure'),
  close: () => ipcRenderer.invoke('projection:close'),
  send: (channel: string, data: unknown) => ipcRenderer.send('projection:send', channel, data),
  sendToMain: (channel: string, data: unknown) =>
    ipcRenderer.send('projection:send-to-main', channel, data),
  getDisplays: () => ipcRenderer.invoke('projection:get-displays'),
  onProjectionMessage: (callback: (channel: string, data: unknown) => void) => {
    ipcRenderer.on('projection:message', (_event, channel, data) => callback(channel, data))
    return () => ipcRenderer.removeAllListeners('projection:message')
  },
  onProjectionOpened: (callback: () => void) => {
    ipcRenderer.on('projection:opened', () => callback())
    return () => ipcRenderer.removeAllListeners('projection:opened')
  },
  onProjectionClosed: (callback: () => void) => {
    ipcRenderer.on('projection:closed', () => callback())
    return () => ipcRenderer.removeAllListeners('projection:closed')
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
