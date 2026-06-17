import { ipcMain } from 'electron'
import { WindowManager } from '../windowManager'
import { isKnownWindow, isMainWindow, validateProjectionMessageTuple } from './validate'

export function registerProjectionHandlers(windowManager: WindowManager): void {
  ipcMain.handle('projection:check', (event) => {
    if (!isKnownWindow(windowManager, event)) return { exists: false }
    return { exists: windowManager.isProjectionOpen() }
  })

  ipcMain.handle('projection:ensure', (event, displayId?: string) => {
    if (!isMainWindow(windowManager, event)) return { created: false }
    const wasOpen = windowManager.isProjectionOpen()
    if (!wasOpen) {
      windowManager.createProjectionWindow(displayId)
    }
    return { created: !wasOpen }
  })

  ipcMain.handle('projection:move-to-display', (event, displayId: string) => {
    if (!isMainWindow(windowManager, event)) return { moved: false }
    return { moved: windowManager.moveProjectionWindow(displayId) }
  })

  ipcMain.handle('projection:close', (event) => {
    if (!isMainWindow(windowManager, event)) return { closed: false }
    windowManager.closeProjection()
    return { closed: true }
  })

  ipcMain.on('projection:send', (event, ...args: unknown[]) => {
    if (!isMainWindow(windowManager, event)) return
    if (!validateProjectionMessageTuple(args)) return
    windowManager.sendToProjection('projection:message', ...args)
  })

  ipcMain.on('projection:send-to-main', (event, ...args: unknown[]) => {
    if (!isKnownWindow(windowManager, event)) return
    if (!validateProjectionMessageTuple(args)) return
    windowManager.sendToMain('projection:message', ...args)
  })

  ipcMain.handle('projection:get-displays', (event) => {
    if (!isMainWindow(windowManager, event)) return []
    const displays = windowManager.getDisplays()
    const primaryId = windowManager.getPrimaryDisplayId()
    return displays.map((display) => ({
      id: display.id,
      label: display.label,
      isPrimary: display.id === primaryId,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor
    }))
  })
}
