import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API給渲染進程
contextBridge.exposeInMainWorld('electronAPI', {
  // 顯示器信息
  getDisplays: () => ipcRenderer.invoke('get-displays'),

  // 投影窗口管理
  checkProjectionWindow: () => ipcRenderer.invoke('check-projection-window'),
  ensureProjectionWindow: () => ipcRenderer.invoke('ensure-projection-window'),

  // 消息傳遞
  sendToProjection: (data: unknown) => ipcRenderer.send('send-to-projection', data),
  sendToMain: (data: unknown) => ipcRenderer.send('send-to-main', data),

  // 監聽消息
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

  // 移除監聽器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // AutoUpdater 相關
  startDownload: () => ipcRenderer.invoke('start-download'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  declineUpdate: () => ipcRenderer.invoke('decline-update'),

  // 監聽更新相關事件
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
