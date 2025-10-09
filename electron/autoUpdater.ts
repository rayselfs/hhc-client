import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

// 追蹤更新下載狀態
let updateDownloaded = false
let updateInfo: Record<string, unknown> | null = null

/**
 * 初始化自動更新功能
 *
 * 行為：
 * 1. 應用程式啟動後 1 秒自動檢查更新
 * 2. 有更新時自動開始下載
 * 3. 下載完成後靜默等待，不打擾用戶
 * 4. 用戶關閉主視窗時才彈出安裝確認對話框
 *
 * @param mainWindow 主視窗實例
 */
export const initAutoUpdater = (mainWindow: BrowserWindow | null) => {
  if (!mainWindow) return

  // 應用啟動後 1 秒自動檢查更新
  setTimeout(() => {
    console.log('Checking for updates...')
    autoUpdater.checkForUpdates()
  }, 1000)

  // 設置事件監聽器
  setupAutoUpdaterListeners(mainWindow)
}

/**
 * 設置 autoUpdater 事件監聽器
 * 處理更新的各個階段並通知主視窗
 */
const setupAutoUpdaterListeners = (mainWindow: BrowserWindow | null) => {
  // 更新可用時，通知主視窗並自動開始下載
  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info)
    }
  })

  // 下載進度更新
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent)
    console.log(`⏬ Download progress: ${percent}%`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-progress', progressObj)
    }
  })

  // 下載完成，保存更新信息，等待用戶關閉視窗時提示
  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded successfully:', info.version)
    console.log('📦 Update will be installed when user closes the main window')
    updateDownloaded = true
    updateInfo = info

    // 發送下載完成事件給前端（讓 UpdateNotification 隱藏通知）
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info)
    }

    // 💡 不發送 update-ready-to-install，等待主視窗關閉時再發送
  })

  // 更新錯誤
  autoUpdater.on('error', (error) => {
    console.error('❌ Update error:', error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', error.message)
    }
  })

  // 沒有可用更新
  autoUpdater.on('update-not-available', (info) => {
    console.log('ℹ️ No updates available, current version:', info.version)
  })
}

/**
 * 檢查是否有已下載的更新
 * @returns 是否有已下載的更新
 */
export const hasUpdateDownloaded = (): boolean => {
  return updateDownloaded
}

/**
 * 獲取已下載的更新信息
 * @returns 更新信息對象
 */
export const getUpdateInfo = () => {
  return updateInfo
}

/**
 * 執行更新安裝並退出應用程式
 * 這個方法會關閉所有視窗並安裝更新
 */
export const installUpdate = () => {
  autoUpdater.quitAndInstall()
}

/**
 * 開始下載更新
 */
export const downloadUpdate = () => {
  return autoUpdater.downloadUpdate()
}
