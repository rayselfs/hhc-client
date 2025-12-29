import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Display information
  getDisplays: () => ipcRenderer.invoke('get-displays'),

  // File System
  saveFile: (filePath: string) => ipcRenderer.invoke('save-file', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  resetUserData: () => ipcRenderer.invoke('reset-user-data'),
  getFilePath: (file: File) => webUtils.getPathForFile(file),

  // Bible API
  getBibleVersions: () => ipcRenderer.invoke('api-bible-get-versions'),
  getBibleContent: (versionId: number) => ipcRenderer.invoke('api-bible-get-content', versionId),
  searchBibleVerses: (params: unknown) => ipcRenderer.invoke('api-bible-search', params),
  onBibleContentChunk: (callback: (chunk: Uint8Array) => void) => {
    ipcRenderer.on('api-bible-content-chunk', (event, chunk) => callback(chunk))
  },

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
    ipcRenderer.on('SYSTEM_GET_STATE', callback)
  },
  onProjectionOpened: (callback: () => void) => {
    ipcRenderer.on('projection-opened', callback)
  },
  onProjectionClosed: (callback: () => void) => {
    ipcRenderer.on('SYSTEM_PROJECTION_CLOSED', callback)
  },
  onNoSecondScreenDetected: (callback: () => void) => {
    ipcRenderer.on('SYSTEM_NO_SECOND_SCREEN', callback)
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // AutoUpdater related
  startDownload: () => ipcRenderer.invoke('start-download'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Language related
  getSystemLocale: () => ipcRenderer.invoke('get-system-locale'),
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

  // Timer related
  timerCommand: (command: unknown) => ipcRenderer.send('timer-command', command),
  timerGetState: () => ipcRenderer.invoke('timer-get-state'),
  timerInitialize: (initialState: unknown) => ipcRenderer.invoke('timer-initialize', initialState),
  onTimerTick: (callback: (state: unknown) => void) => {
    ipcRenderer.on('timer-tick', (event, state) => callback(state))
  },

  // Media related
  mediaCommand: (command: unknown) => ipcRenderer.send('media-command', command),
  mediaGetState: () => ipcRenderer.invoke('media-get-state'),
  onMediaStateUpdate: (callback: (state: unknown) => void) => {
    ipcRenderer.on('media-state-update', (event, state) => callback(state))
  },
})
