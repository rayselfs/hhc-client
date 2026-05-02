import { ipcMain, BrowserWindow } from 'electron'
import type { WindowManager } from '../windowManager'
import { isKnownWindow } from './validate'
import type { AzureSpeechConfig, AzureSpeechEventData } from '@shared/types/azure-speech'

interface AzureSpeechRecognizer {
  isRecognizing: boolean
}

let recognizer: AzureSpeechRecognizer | null = null

export function registerAzureSpeechHandlers(wm: WindowManager): void {
  ipcMain.handle('azureSpeech:start', (event: Electron.IpcMainInvokeEvent, config: unknown) => {
    if (!isKnownWindow(wm, event)) return

    if (
      !config ||
      typeof config !== 'object' ||
      typeof (config as Record<string, unknown>).language !== 'string' ||
      typeof (config as Record<string, unknown>).region !== 'string' ||
      typeof (config as Record<string, unknown>).apiKey !== 'string'
    ) {
      sendEventToAllRenderer(
        { type: 'error', error: 'Invalid speech config' },
        wm.getMainWindow(),
        wm.getProjectionWindow()
      )
      return
    }

    const speechConfig = config as AzureSpeechConfig

    try {
      if (recognizer) {
        recognizer.isRecognizing = true
      } else {
        recognizer = { isRecognizing: true }
      }

      sendEventToAllRenderer(
        { type: 'sessionStarted', data: { language: speechConfig.language } },
        wm.getMainWindow(),
        wm.getProjectionWindow()
      )

      sendEventToAllRenderer(
        { type: 'recognizing', data: {} },
        wm.getMainWindow(),
        wm.getProjectionWindow()
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      sendEventToAllRenderer(
        { type: 'error', error: `Failed to start recognition: ${errorMsg}` },
        wm.getMainWindow(),
        wm.getProjectionWindow()
      )
    }
  })

  ipcMain.handle('azureSpeech:stop', (event: Electron.IpcMainInvokeEvent) => {
    if (!isKnownWindow(wm, event)) return

    try {
      if (recognizer) {
        recognizer.isRecognizing = false
      }

      sendEventToAllRenderer(
        { type: 'sessionStopped', data: {} },
        wm.getMainWindow(),
        wm.getProjectionWindow()
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      sendEventToAllRenderer(
        { type: 'error', error: `Failed to stop recognition: ${errorMsg}` },
        wm.getMainWindow(),
        wm.getProjectionWindow()
      )
    }
  })

  ipcMain.handle('azureSpeech:isRecognizing', (event: Electron.IpcMainInvokeEvent) => {
    if (!isKnownWindow(wm, event)) return false
    return recognizer?.isRecognizing ?? false
  })
}

function sendEventToAllRenderer(
  eventData: AzureSpeechEventData,
  mainWindow: BrowserWindow | null,
  projectionWindow: BrowserWindow | null
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('azureSpeech:event', eventData)
  }
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('azureSpeech:event', eventData)
  }
}
