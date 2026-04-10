import { ipcMain } from 'electron'
import { WindowManager } from '../windowManager'
import { isKnownWindow, isMainWindow } from './validate'
import type { ProjectionMessageTuple } from '@shared/projection-messages'

export function registerProjectionHandlers(windowManager: WindowManager): void {
  ipcMain.handle('projection:check', (event) => {
    if (!isKnownWindow(windowManager, event)) return { exists: false }
    return { exists: windowManager.isProjectionOpen() }
  })

  ipcMain.handle('projection:ensure', (event) => {
    if (!isMainWindow(windowManager, event)) return { created: false }
    const wasOpen = windowManager.isProjectionOpen()
    if (!wasOpen) {
      windowManager.createProjectionWindow()
    }
    return { created: !wasOpen }
  })

  ipcMain.handle('projection:close', (event) => {
    if (!isMainWindow(windowManager, event)) return { closed: false }
    windowManager.closeProjection()
    return { closed: true }
  })

  ipcMain.on('projection:send', (event, ...args: [...ProjectionMessageTuple]) => {
    if (!isMainWindow(windowManager, event)) return
    windowManager.sendToProjection('projection:message', ...args)
  })

  ipcMain.on('projection:send-to-main', (event, ...args: [...ProjectionMessageTuple]) => {
    if (!isKnownWindow(windowManager, event)) return
    windowManager.sendToMain('projection:message', ...args)
  })

  ipcMain.handle('projection:get-displays', (event) => {
    if (!isMainWindow(windowManager, event)) return []
    const displays = windowManager.getDisplays()
    return displays.map((display) => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor
    }))
  })
}
