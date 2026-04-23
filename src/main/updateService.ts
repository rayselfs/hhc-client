import { autoUpdater } from 'electron-updater'
import { app, ipcMain } from 'electron'
import { WindowManager } from './windowManager'

export function registerUpdateService(wm: WindowManager): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  const sendStatus = (payload: {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
    version?: string
    error?: string
  }): void => {
    wm.sendToMain('update:status-changed', payload)
  }

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', () => {
    sendStatus({ status: 'downloading' })
  })

  autoUpdater.on('update-downloaded', () => {
    sendStatus({ status: 'downloaded' })
  })

  autoUpdater.on('error', (err) => {
    sendStatus({ status: 'error', error: err.message })
  })

  ipcMain.handle('update:check', async () => {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const updateAvailable = result.updateInfo.version !== app.getVersion()
      return { updateAvailable, version: result.updateInfo.version }
    }
    return { updateAvailable: false }
  })

  ipcMain.handle('update:download-and-install', async () => {
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updateService] Initial check failed:', err)
    })
  }, 3000)
}
