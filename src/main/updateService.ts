import { app, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { IpcMainToRendererMap } from '../shared/ipc-channels'
import { downloadMacUpdate } from './macUpdateDownloader'
import { isMainWindow } from './ipc/validate'
import { WindowManager } from './windowManager'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function registerUpdateService(wm: WindowManager): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = process.platform === 'win32'
  autoUpdater.autoInstallOnAppQuit = false

  let checking = false
  let downloading = false
  let availableVersion: string | undefined

  const sendStatus = (payload: IpcMainToRendererMap['update:status-changed'][0]): void => {
    wm.sendToMain('update:status-changed', payload)
  }

  const checkForUpdates = async (): Promise<
    Awaited<ReturnType<typeof autoUpdater.checkForUpdates>>
  > => {
    if (checking || downloading) return null

    checking = true
    try {
      return await autoUpdater.checkForUpdates()
    } finally {
      checking = false
    }
  }

  autoUpdater.on('checking-for-update', () => {
    checking = true
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    checking = false
    availableVersion = info.version
    downloading = process.platform === 'win32'
    sendStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    checking = false
    downloading = false
    availableVersion = undefined
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    downloading = true
    sendStatus({
      status: 'downloading',
      version: availableVersion,
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    downloading = false
    availableVersion = info.version || availableVersion
    sendStatus({ status: 'downloaded', version: availableVersion })
  })

  autoUpdater.on('error', (error) => {
    checking = false
    downloading = false
    sendStatus({ status: 'error', error: error.message })
  })

  ipcMain.handle('update:check', async (event) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized update access')
    const result = await checkForUpdates()
    if (!result?.updateInfo) return { updateAvailable: false }

    return {
      updateAvailable: result.updateInfo.version !== app.getVersion(),
      version: result.updateInfo.version
    }
  })

  ipcMain.handle('update:install-downloaded', (event) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized update access')
    if (process.platform !== 'win32') {
      throw new Error('Downloaded updater installation is only available on Windows')
    }
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('update:download-mac-installer', async (event) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized update access')
    if (process.platform !== 'darwin') {
      throw new Error('Manual DMG download is only available on macOS')
    }
    if (!availableVersion) throw new Error('No macOS update is available')
    if (downloading) throw new Error('A macOS update download is already in progress')

    const mainWindow = wm.getMainWindow()
    if (!mainWindow) throw new Error('Main window is not available')
    const version = availableVersion

    try {
      downloading = true
      const dmgPath = await downloadMacUpdate(
        mainWindow,
        version,
        (percent) => sendStatus({ status: 'downloading', version, percent }),
        () => sendStatus({ status: 'verifying', version })
      )
      const openError = await shell.openPath(dmgPath)
      if (openError) throw new Error(openError)

      downloading = false
      sendStatus({ status: 'installer-opened', version })
    } catch (error) {
      downloading = false
      const message = error instanceof Error ? error.message : String(error)
      sendStatus({ status: 'error', error: message })
      throw error
    }
  })

  const runScheduledCheck = (): void => {
    checkForUpdates().catch((error) => {
      console.error('[updateService] Update check failed:', error)
    })
  }

  setTimeout(runScheduledCheck, 3000)
  setInterval(runScheduledCheck, UPDATE_CHECK_INTERVAL_MS)
}
