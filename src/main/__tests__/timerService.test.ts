import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([])
  },
  ipcMain: {
    handle: vi.fn()
  }
}))

import { BrowserWindow, ipcMain } from 'electron'
import { TimerService } from '../timerService'

function makeMockWindow() {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn() }
  }
}

describe('TimerService', () => {
  let service: TimerService

  beforeEach(() => {
    vi.useFakeTimers()
    service = new TimerService()
  })

  afterEach(() => {
    service.dispose()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('start command', () => {
    it('sets status to running', () => {
      service.handleCommand({ type: 'start' })
      expect(service.getState().status).toBe('running')
    })

    it('resets remainingSeconds to totalDuration on start', () => {
      service.handleCommand({ type: 'setDuration', seconds: 120 })
      service.handleCommand({ type: 'start' })
      expect(service.getState().remainingSeconds).toBe(120)
    })
  })

  describe('pause command', () => {
    it('sets status to paused', () => {
      service.handleCommand({ type: 'start' })
      service.handleCommand({ type: 'pause' })
      expect(service.getState().status).toBe('paused')
    })

    it('preserves remainingSeconds when paused', () => {
      service.handleCommand({ type: 'setDuration', seconds: 60 })
      service.handleCommand({ type: 'start' })
      const beforePause = service.getState().remainingSeconds
      service.handleCommand({ type: 'pause' })
      expect(service.getState().remainingSeconds).toBe(beforePause)
    })

    it('is a no-op when not running', () => {
      service.handleCommand({ type: 'pause' })
      expect(service.getState().status).toBe('stopped')
    })
  })

  describe('resume command', () => {
    it('sets status back to running after pause', () => {
      service.handleCommand({ type: 'start' })
      service.handleCommand({ type: 'pause' })
      service.handleCommand({ type: 'resume' })
      expect(service.getState().status).toBe('running')
    })

    it('is a no-op when not paused', () => {
      service.handleCommand({ type: 'resume' })
      expect(service.getState().status).toBe('stopped')
    })
  })

  describe('reset command', () => {
    it('sets status to stopped', () => {
      service.handleCommand({ type: 'start' })
      service.handleCommand({ type: 'reset' })
      expect(service.getState().status).toBe('stopped')
    })

    it('restores remainingSeconds to default totalDuration (300)', () => {
      service.handleCommand({ type: 'start' })
      service.handleCommand({ type: 'reset' })
      expect(service.getState().remainingSeconds).toBe(300)
    })

    it('resets overtimeSeconds to 0', () => {
      service.handleCommand({ type: 'start' })
      service.handleCommand({ type: 'reset' })
      expect(service.getState().overtimeSeconds).toBe(0)
    })
  })

  describe('setDuration command', () => {
    it('updates totalDuration and remainingSeconds when stopped', () => {
      service.handleCommand({ type: 'setDuration', seconds: 120 })
      expect(service.getState().remainingSeconds).toBe(120)
    })

    it('does not change remainingSeconds when running', () => {
      service.handleCommand({ type: 'start' })
      const before = service.getState().remainingSeconds
      service.handleCommand({ type: 'setDuration', seconds: 999 })
      expect(service.getState().remainingSeconds).toBe(before)
    })

    it('clamps duration to minimum 1 second', () => {
      service.handleCommand({ type: 'setDuration', seconds: 0 })
      expect(service.getState().remainingSeconds).toBe(1)
    })
  })

  describe('addTime command', () => {
    it('increases remainingSeconds by the given amount', () => {
      service.handleCommand({ type: 'start' })
      const before = service.getState().remainingSeconds
      service.handleCommand({ type: 'addTime', seconds: 30 })
      expect(service.getState().remainingSeconds).toBe(before + 30)
    })

    it('also works when stopped', () => {
      const before = service.getState().remainingSeconds
      service.handleCommand({ type: 'addTime', seconds: 30 })
      expect(service.getState().remainingSeconds).toBe(before + 30)
    })
  })

  describe('removeTime command', () => {
    it('decreases remainingSeconds by the given amount', () => {
      service.handleCommand({ type: 'start' })
      const before = service.getState().remainingSeconds
      service.handleCommand({ type: 'removeTime', seconds: 30 })
      expect(service.getState().remainingSeconds).toBe(before - 30)
    })

    it('clamps remainingSeconds to 0 minimum', () => {
      service.handleCommand({ type: 'setDuration', seconds: 10 })
      service.handleCommand({ type: 'start' })
      service.handleCommand({ type: 'removeTime', seconds: 999 })
      expect(service.getState().remainingSeconds).toBe(0)
    })
  })

  describe('broadcast bug fix — lastBroadcastRemaining updated after broadcast', () => {
    it('updates lastBroadcastRemaining to match current remainingSeconds after start', () => {
      const win = makeMockWindow()
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([win as never])

      service.handleCommand({ type: 'start' })

      const lastBroadcast = (service as unknown as { lastBroadcastRemaining: number })
        .lastBroadcastRemaining
      expect(lastBroadcast).toBe(service.getState().remainingSeconds)
    })

    it('sends timer-tick to all non-destroyed windows', () => {
      const win = makeMockWindow()
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([win as never])

      service.handleCommand({ type: 'start' })

      expect(win.webContents.send).toHaveBeenCalledWith('timer-tick', expect.any(Object))
    })

    it('skips destroyed windows during broadcast', () => {
      const destroyedWin = { isDestroyed: () => true, webContents: { send: vi.fn() } }
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([destroyedWin as never])

      service.handleCommand({ type: 'start' })

      expect(destroyedWin.webContents.send).not.toHaveBeenCalled()
    })
  })

  describe('startStopwatch command', () => {
    it('sets stopwatch status to running', () => {
      service.handleCommand({ type: 'startStopwatch' })
      expect(service.getState().stopwatch.status).toBe('running')
    })

    it('is a no-op if stopwatch is already running', () => {
      service.handleCommand({ type: 'startStopwatch' })
      const elapsed1 = service.getState().stopwatch.elapsedMs
      service.handleCommand({ type: 'startStopwatch' })
      expect(service.getState().stopwatch.elapsedMs).toBeGreaterThanOrEqual(elapsed1)
    })
  })

  describe('pauseStopwatch command', () => {
    it('sets stopwatch status to paused', () => {
      service.handleCommand({ type: 'startStopwatch' })
      service.handleCommand({ type: 'pauseStopwatch' })
      expect(service.getState().stopwatch.status).toBe('paused')
    })

    it('is a no-op when stopwatch not running', () => {
      service.handleCommand({ type: 'pauseStopwatch' })
      expect(service.getState().stopwatch.status).toBe('stopped')
    })
  })

  describe('resetStopwatch command', () => {
    it('sets stopwatch status to stopped and resets elapsedMs', () => {
      service.handleCommand({ type: 'startStopwatch' })
      service.handleCommand({ type: 'resetStopwatch' })
      const sw = service.getState().stopwatch
      expect(sw.status).toBe('stopped')
      expect(sw.elapsedMs).toBe(0)
    })
  })

  describe('setMode command', () => {
    it('updates the mode in internal settings', () => {
      service.handleCommand({ type: 'setMode', mode: 'stopwatch' })
      const settings = (service as unknown as { settings: { mode: string } }).settings
      expect(settings.mode).toBe('stopwatch')
    })
  })

  describe('setReminder command', () => {
    it('enables reminder with given duration', () => {
      service.handleCommand({ type: 'setReminder', enabled: true, durationSeconds: 60 })
      const settings = (
        service as unknown as {
          settings: { reminderEnabled: boolean; reminderDuration: number }
        }
      ).settings
      expect(settings.reminderEnabled).toBe(true)
      expect(settings.reminderDuration).toBe(60)
    })
  })

  describe('setOvertimeMessage command', () => {
    it('sets overtime message configuration', () => {
      service.handleCommand({
        type: 'setOvertimeMessage',
        enabled: true,
        message: 'Time is up!'
      })
      const settings = (
        service as unknown as {
          settings: { overtimeMessageEnabled: boolean; overtimeMessage: string }
        }
      ).settings
      expect(settings.overtimeMessageEnabled).toBe(true)
      expect(settings.overtimeMessage).toBe('Time is up!')
    })
  })

  describe('initializeState', () => {
    it('applies new settings', () => {
      service.initializeState({
        mode: 'clock',
        totalDuration: 600,
        reminderEnabled: true,
        reminderDuration: 120,
        overtimeMessageEnabled: false,
        overtimeMessage: '',
        timezone: 'Asia/Taipei'
      })
      const settings = (service as unknown as { settings: { totalDuration: number } }).settings
      expect(settings.totalDuration).toBe(600)
    })

    it('updates remainingSeconds when stopped', () => {
      service.initializeState({
        mode: 'timer',
        totalDuration: 600,
        reminderEnabled: false,
        reminderDuration: 0,
        overtimeMessageEnabled: false,
        overtimeMessage: '',
        timezone: 'UTC'
      })
      expect(service.getState().remainingSeconds).toBe(600)
    })

    it('does not change remainingSeconds when running', () => {
      service.handleCommand({ type: 'start' })
      const before = service.getState().remainingSeconds
      service.initializeState({
        mode: 'timer',
        totalDuration: 999,
        reminderEnabled: false,
        reminderDuration: 0,
        overtimeMessageEnabled: false,
        overtimeMessage: '',
        timezone: 'UTC'
      })
      expect(service.getState().remainingSeconds).toBe(before)
    })
  })

  describe('registerIpcHandlers', () => {
    it('registers timer:command, timer:get-state, and timer:initialize handlers', () => {
      service.registerIpcHandlers()
      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith('timer:command', expect.any(Function))
      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith(
        'timer:get-state',
        expect.any(Function)
      )
      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith(
        'timer:initialize',
        expect.any(Function)
      )
    })
  })

  describe('dispose', () => {
    it('stops the interval (no further ticks)', () => {
      const tickSpy = vi.spyOn(service as never, 'tick')
      service.dispose()
      vi.advanceTimersByTime(500)
      expect(tickSpy).not.toHaveBeenCalled()
    })
  })

  describe('getState', () => {
    it('returns idle phase when stopped', () => {
      expect(service.getState().phase).toBe('idle')
    })

    it('returns main phase when running with no reminder', () => {
      service.handleCommand({ type: 'start' })
      expect(service.getState().phase).toBe('main')
    })

    it('returns warning phase when remaining <= reminderDuration', () => {
      service.handleCommand({ type: 'setDuration', seconds: 50 })
      service.handleCommand({ type: 'setReminder', enabled: true, durationSeconds: 60 })
      service.handleCommand({ type: 'start' })
      expect(service.getState().phase).toBe('warning')
    })

    it('returns formatted time string (default 300s = 05:00)', () => {
      expect(service.getState().formattedTime).toBe('05:00')
    })

    it('returns progress 1 when stopped at full duration', () => {
      expect(service.getState().progress).toBe(1)
    })

    it('includes stopwatch in returned state', () => {
      const state = service.getState()
      expect(state.stopwatch).toBeDefined()
      expect(state.stopwatch.status).toBe('stopped')
      expect(state.stopwatch.formattedTime).toBeDefined()
    })
  })
})
