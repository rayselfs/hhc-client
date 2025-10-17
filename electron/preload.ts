import { contextBridge, ipcRenderer } from 'electron'

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Display information
  getDisplays: () => ipcRenderer.invoke('get-displays'),

  // Projection window management
  checkProjectionWindow: () => ipcRenderer.invoke('check-projection-window'),
  ensureProjectionWindow: () => ipcRenderer.invoke('ensure-projection-window'),
  closeProjectionWindow: () => ipcRenderer.invoke('close-projection-window'),

  // Message passing
  sendToProjection: (data: unknown) => ipcRenderer.send('send-to-projection', data),
  sendToMain: (data: unknown) => ipcRenderer.send('send-to-main', data),

  // Listen for messages
  onProjectionMessage: (callback: (data: unknown) => void) => {
    ipcRenderer.on('projection-message', (event, data) => callback(data))
  },
  onMainMessage: (callback: (data: unknown) => void) => {
    ipcRenderer.on('main-message', (event, data) => callback(data))
  },
  onGetCurrentState: (callback: () => void) => {
    ipcRenderer.on('get-current-state', callback)
  },
  onProjectionOpened: (callback: () => void) => {
    ipcRenderer.on('projection-opened', callback)
  },
  onProjectionClosed: (callback: () => void) => {
    ipcRenderer.on('projection-closed', callback)
  },
  onNoSecondScreenDetected: (callback: () => void) => {
    ipcRenderer.on('no-second-screen-detected', callback)
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // AutoUpdater related
  startDownload: () => ipcRenderer.invoke('start-download'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Language related
  updateLanguage: (language: string) => ipcRenderer.invoke('update-language', language),

  // Listen for update related events
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    ipcRenderer.on('update-available', (event, info) => callback(info))
  },
  onDownloadProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: (info: unknown) => void) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info))
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (event, error) => callback(error))
  },
})
