import { ipcMain } from 'electron'
import { timerService } from '../timerService'
import type { WindowManager } from '../windowManager'
import { isKnownWindow, validateTimerCommand, validateTimerSettings } from './validate'

export function registerTimerHandlers(wm: WindowManager): void {
  ipcMain.handle('timer:command', (event, cmd: unknown) => {
    if (!isKnownWindow(wm, event)) return
    if (!validateTimerCommand(cmd)) return
    timerService.handleCommand(cmd as Parameters<typeof timerService.handleCommand>[0])
  })

  ipcMain.handle('timer:get-state', (event) => {
    if (!isKnownWindow(wm, event)) return null
    return timerService.getState()
  })

  ipcMain.handle('timer:initialize', (event, settings: unknown) => {
    if (!isKnownWindow(wm, event)) return
    if (!validateTimerSettings(settings)) return
    timerService.initializeState(settings as Parameters<typeof timerService.initializeState>[0])
  })
}
