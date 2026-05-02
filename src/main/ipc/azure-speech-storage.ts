import { safeStorage, app, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

const SAFE_STORAGE_KEY_FILE = 'azure-speech-api-key.enc'

function getKeyFilePath(): string {
  return join(app.getPath('userData'), SAFE_STORAGE_KEY_FILE)
}

export function registerAzureSpeechStorageHandlers(wm: WindowManager): void {
  ipcMain.handle('azureSpeech:saveKey', (event: Electron.IpcMainInvokeEvent, apiKey: unknown) => {
    if (!isMainWindow(wm, event)) return
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('Invalid API key')
    }

    try {
      const encrypted = safeStorage.encryptString(apiKey)
      const filePath = getKeyFilePath()
      writeFileSync(filePath, encrypted)
    } catch (error) {
      console.error('[AZURE_SPEECH] Failed to save API key:', error)
      throw error
    }
  })

  ipcMain.handle('azureSpeech:loadKey', (event: Electron.IpcMainInvokeEvent) => {
    if (!isMainWindow(wm, event)) return ''

    try {
      const filePath = getKeyFilePath()
      if (!existsSync(filePath)) {
        return ''
      }
      const encrypted = readFileSync(filePath)
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      console.error('[AZURE_SPEECH] Failed to load API key:', error)
      return ''
    }
  })

  ipcMain.handle('azureSpeech:deleteKey', (event: Electron.IpcMainInvokeEvent) => {
    if (!isMainWindow(wm, event)) return

    try {
      const filePath = getKeyFilePath()
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch (error) {
      console.error('[AZURE_SPEECH] Failed to delete API key:', error)
      throw error
    }
  })
}
