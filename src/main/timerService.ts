import { performance } from 'perf_hooks'
import { BrowserWindow, ipcMain } from 'electron'
import type {
  TimerCommand,
  TimerMode,
  TimerPhase,
  TimerSettings,
  TimerState,
  StopwatchState,
  TimerTickPayload
} from '@shared/types/timer'

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatStopwatch(elapsedMs: number): string {
  const totalCs = Math.floor(elapsedMs / 10)
  const cs = totalCs % 100
  const totalSecs = Math.floor(totalCs / 100)
  const secs = totalSecs % 60
  const mins = Math.floor(totalSecs / 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function computePhase(
  status: TimerState['status'],
  remainingSeconds: number,
  reminderEnabled: boolean,
  reminderDuration: number
): TimerPhase {
  if (status === 'stopped') return 'idle'
  if (remainingSeconds <= 0) return 'overtime'
  if (reminderEnabled && remainingSeconds <= reminderDuration) return 'warning'
  return 'main'
}

function computeProgress(remainingSeconds: number, totalDuration: number): number {
  if (totalDuration <= 0) return 0
  return Math.max(0, Math.min(1, remainingSeconds / totalDuration))
}

interface InternalTimerSettings extends TimerSettings {}

interface InternalTimerState {
  status: TimerState['status']
  remainingSeconds: number
  overtimeSeconds: number
}

interface InternalStopwatchState {
  status: StopwatchState['status']
  elapsedMs: number
  startMs: number | null // performance.now() anchor for current run
}

export class TimerService {
  private settings: InternalTimerSettings = {
    mode: 'timer',
    totalDuration: 300,
    reminderEnabled: false,
    reminderDuration: 0,
    overtimeMessageEnabled: false,
    overtimeMessage: '',
    timezone: 'UTC'
  }

  private timer: InternalTimerState = {
    status: 'stopped',
    remainingSeconds: 300,
    overtimeSeconds: 0
  }

  private stopwatch: InternalStopwatchState = {
    status: 'stopped',
    elapsedMs: 0,
    startMs: null
  }

  private intervalId: NodeJS.Timeout | null = null
  private targetEndTime: number | null = null

  private lastBroadcastRemaining: number = -1
  private lastBroadcastTime: number = 0

  constructor() {
    this.startInterval()
  }

  private startInterval(): void {
    if (this.intervalId !== null) return
    this.intervalId = setInterval(() => this.tick(), 100)
  }

  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private tick(): void {
    const nowPerfMs = performance.now()
    const nowMs = Date.now()

    if (this.timer.status === 'running' && this.targetEndTime !== null) {
      const remainingMs = Math.max(0, this.targetEndTime - nowPerfMs)
      const rawRemaining = remainingMs / 1000
      this.timer.remainingSeconds = Math.ceil(rawRemaining)

      if (rawRemaining <= 0) {
        this.timer.remainingSeconds = 0
        this.timer.overtimeSeconds = Math.abs(Math.floor(rawRemaining))
      } else {
        this.timer.overtimeSeconds = 0
      }
    }

    if (this.stopwatch.status === 'running' && this.stopwatch.startMs !== null) {
      this.stopwatch.elapsedMs = nowPerfMs - this.stopwatch.startMs
    }

    const secondChanged = this.timer.remainingSeconds !== this.lastBroadcastRemaining
    const secondElapsed = nowMs - this.lastBroadcastTime >= 1000
    const stopwatchRunning = this.stopwatch.status === 'running'

    if (secondChanged || secondElapsed || stopwatchRunning) {
      this.broadcast()
    }
  }

  private broadcast(): void {
    const payload = this.buildTickPayload()
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('timer-tick', payload)
      }
    })
    // FIX: update AFTER broadcast (original bug — these were never updated)
    this.lastBroadcastRemaining = this.timer.remainingSeconds
    this.lastBroadcastTime = Date.now()
  }

  private buildTickPayload(): TimerTickPayload {
    const {
      mode,
      totalDuration,
      reminderEnabled,
      reminderDuration,
      overtimeMessageEnabled,
      overtimeMessage
    } = this.settings
    const { status, remainingSeconds, overtimeSeconds } = this.timer

    const phase = computePhase(status, remainingSeconds, reminderEnabled, reminderDuration)
    const progress = computeProgress(remainingSeconds, totalDuration)

    let mainDisplay: string
    let subDisplay: string | null = null
    let overtimeDisplay: string | null = null

    switch (phase) {
      case 'idle':
        mainDisplay = formatTime(totalDuration)
        break
      case 'main':
        if (reminderEnabled) {
          mainDisplay = formatTime(remainingSeconds - reminderDuration)
          subDisplay = formatTime(reminderDuration)
        } else {
          mainDisplay = formatTime(remainingSeconds)
        }
        break
      case 'warning':
        mainDisplay = formatTime(remainingSeconds)
        break
      case 'overtime':
        mainDisplay = '00:00'
        overtimeDisplay = formatTime(overtimeSeconds)
        break
      default:
        mainDisplay = formatTime(remainingSeconds)
    }

    return {
      mode,
      remainingSeconds,
      phase,
      mainDisplay,
      subDisplay: subDisplay ?? overtimeDisplay,
      progress,
      overtimeSeconds,
      overtimeMessage: overtimeMessageEnabled ? overtimeMessage : null
    }
  }

  handleCommand(cmd: TimerCommand): void {
    switch (cmd.type) {
      case 'start':
        this.handleStart()
        break
      case 'pause':
        this.handlePause()
        break
      case 'resume':
        this.handleResume()
        break
      case 'reset':
        this.handleReset()
        break
      case 'setDuration':
        this.handleSetDuration(cmd.seconds)
        break
      case 'addTime':
        this.handleAddTime(cmd.seconds)
        break
      case 'removeTime':
        this.handleRemoveTime(cmd.seconds)
        break
      case 'setMode':
        this.handleSetMode(cmd.mode)
        break
      case 'setReminder':
        this.handleSetReminder(cmd.enabled, cmd.durationSeconds)
        break
      case 'setOvertimeMessage':
        this.handleSetOvertimeMessage(cmd.enabled, cmd.message)
        break
      case 'startStopwatch':
        this.handleStartStopwatch()
        break
      case 'pauseStopwatch':
        this.handlePauseStopwatch()
        break
      case 'resetStopwatch':
        this.handleResetStopwatch()
        break
    }
  }

  private handleStart(): void {
    this.timer.remainingSeconds = this.settings.totalDuration
    this.timer.overtimeSeconds = 0
    this.timer.status = 'running'
    this.targetEndTime = performance.now() + this.timer.remainingSeconds * 1000
    this.broadcast()
  }

  private handlePause(): void {
    if (this.timer.status !== 'running') return
    this.timer.status = 'paused'
    this.targetEndTime = null
    this.broadcast()
  }

  private handleResume(): void {
    if (this.timer.status !== 'paused') return
    this.timer.status = 'running'
    this.targetEndTime = performance.now() + this.timer.remainingSeconds * 1000
    this.broadcast()
  }

  private handleReset(): void {
    this.timer.status = 'stopped'
    this.timer.remainingSeconds = this.settings.totalDuration
    this.timer.overtimeSeconds = 0
    this.targetEndTime = null
    this.broadcast()
  }

  private handleSetDuration(seconds: number): void {
    const clamped = Math.max(1, seconds)
    this.settings.totalDuration = clamped
    if (this.timer.status === 'stopped') {
      this.timer.remainingSeconds = clamped
    }
    this.broadcast()
  }

  private handleAddTime(seconds: number): void {
    this.timer.remainingSeconds += seconds
    if (this.timer.status === 'running' && this.targetEndTime !== null) {
      this.targetEndTime += seconds * 1000
    }
    this.broadcast()
  }

  private handleRemoveTime(seconds: number): void {
    this.timer.remainingSeconds = Math.max(0, this.timer.remainingSeconds - seconds)
    if (this.timer.status === 'running' && this.targetEndTime !== null) {
      this.targetEndTime -= seconds * 1000
    }
    this.broadcast()
  }

  private handleSetMode(mode: TimerMode): void {
    this.settings.mode = mode
    this.broadcast()
  }

  private handleSetReminder(enabled: boolean, durationSeconds: number): void {
    this.settings.reminderEnabled = enabled
    this.settings.reminderDuration = durationSeconds
    this.broadcast()
  }

  private handleSetOvertimeMessage(enabled: boolean, message: string): void {
    this.settings.overtimeMessageEnabled = enabled
    this.settings.overtimeMessage = message
    this.broadcast()
  }

  private handleStartStopwatch(): void {
    if (this.stopwatch.status === 'running') return
    this.stopwatch.status = 'running'
    this.stopwatch.startMs = performance.now() - this.stopwatch.elapsedMs
    this.broadcast()
  }

  private handlePauseStopwatch(): void {
    if (this.stopwatch.status !== 'running') return
    if (this.stopwatch.startMs !== null) {
      this.stopwatch.elapsedMs = performance.now() - this.stopwatch.startMs
    }
    this.stopwatch.status = 'paused'
    this.stopwatch.startMs = null
    this.broadcast()
  }

  private handleResetStopwatch(): void {
    this.stopwatch.status = 'stopped'
    this.stopwatch.elapsedMs = 0
    this.stopwatch.startMs = null
    this.broadcast()
  }

  getState(): TimerState & { stopwatch: StopwatchState } {
    const { totalDuration, reminderEnabled, reminderDuration } = this.settings
    const { status, remainingSeconds, overtimeSeconds } = this.timer

    const phase = computePhase(status, remainingSeconds, reminderEnabled, reminderDuration)
    const progress = computeProgress(remainingSeconds, totalDuration)

    const timerState: TimerState = {
      status,
      remainingSeconds,
      phase,
      overtimeSeconds,
      progress,
      formattedTime: formatTime(remainingSeconds)
    }

    const stopwatchState: StopwatchState = {
      status: this.stopwatch.status,
      elapsedMs: this.stopwatch.elapsedMs,
      formattedTime: formatStopwatch(this.stopwatch.elapsedMs)
    }

    return { ...timerState, stopwatch: stopwatchState }
  }

  initializeState(settings: TimerSettings): void {
    this.settings = { ...settings }
    if (this.timer.status === 'stopped') {
      this.timer.remainingSeconds = settings.totalDuration
    }
    this.broadcast()
  }

  registerIpcHandlers(): void {
    ipcMain.handle('timer:command', (_event, cmd: TimerCommand) => {
      this.handleCommand(cmd)
    })

    ipcMain.handle('timer:get-state', () => {
      return this.getState()
    })

    ipcMain.handle('timer:initialize', (_event, settings: TimerSettings) => {
      this.initializeState(settings)
    })
  }

  dispose(): void {
    this.stopInterval()
  }
}

export const timerService = new TimerService()
