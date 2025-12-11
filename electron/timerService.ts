/**
 * Timer Service for Electron Main Process
 * Manages timer state and broadcasts updates to all renderer windows
 */
import { BrowserWindow } from 'electron'
import type { TimerMode } from '../src/types/common'

export interface TimerState {
  mode: TimerMode
  state: 'stopped' | 'running' | 'paused'
  remainingTime: number // seconds
  timerDuration: number // seconds (for progress calculation)
  originalDuration: number // seconds (user-set duration)
  startTime?: Date // for clock mode
  currentTime: Date // current server time
  timezone: string
  stopwatchState: 'stopped' | 'running' | 'paused'
  stopwatchElapsedTime: number // milliseconds
  stopwatchStartTime?: number // for precise calculation
}

export interface TimerCommand {
  action:
    | 'start'
    | 'pause'
    | 'reset'
    | 'resume'
    | 'setDuration'
    | 'addTime'
    | 'removeTime'
    | 'setMode'
    | 'setTimezone'
    | 'startStopwatch'
    | 'pauseStopwatch'
    | 'resetStopwatch'
  duration?: number
  seconds?: number
  mode?: TimerMode
  timezone?: string
}

export class TimerService {
  private state: TimerState
  private intervalId: NodeJS.Timeout | null = null
  private windows: BrowserWindow[] = []
  private targetEndTime: number | null = null
  private lastBroadcastTime: string = ''
  private lastBroadcastRemaining: number = -1

  constructor() {
    this.state = {
      mode: 'timer' as TimerMode,
      state: 'stopped',
      remainingTime: 300, // 5 minutes default
      timerDuration: 300,
      originalDuration: 300,
      currentTime: new Date(),
      timezone: 'Asia/Taipei',
      stopwatchState: 'stopped',
      stopwatchElapsedTime: 0,
    }
    // Start continuous interval immediately
    this.startInterval()
  }

  /**
   * Register a window to receive timer updates
   */
  registerWindow(window: BrowserWindow) {
    if (!this.windows.includes(window)) {
      this.windows.push(window)
    }
  }

  /**
   * Unregister a window
   */
  unregisterWindow(window: BrowserWindow) {
    this.windows = this.windows.filter((w) => w !== window && !w.isDestroyed())
  }

  /**
   * Broadcast timer state to all registered windows
   */
  private broadcast() {
    const stateToSend = {
      ...this.state,
      startTime: this.state.startTime?.toISOString(), // Convert Date to string for IPC
      currentTime: this.state.currentTime.toISOString(), // Convert Date to string for IPC
    }

    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('timer-tick', stateToSend)
      }
    })
  }

  /**
   * Broadcast only time updates (lightweight)
   */
  private broadcastTick() {
    const stateToSend = {
      remainingTime: this.state.remainingTime,
      currentTime: this.state.currentTime.toISOString(),
      stopwatchElapsedTime: this.state.stopwatchElapsedTime,
    }

    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('timer-tick', stateToSend)
      }
    })
  }

  /**
   * Start the timer interval
   */
  private startInterval() {
    if (this.intervalId) {
      return
    }

    this.intervalId = setInterval(() => {
      // Always update current time
      this.state.currentTime = new Date()

      // Handle timer logic only if running
      if (this.state.state === 'running') {
        if (this.targetEndTime === null) {
          this.targetEndTime = Date.now() + this.state.remainingTime * 1000
        }

        const remaining = Math.ceil((this.targetEndTime - Date.now()) / 1000)
        this.state.remainingTime = Math.max(0, remaining)

        if (this.state.remainingTime <= 0) {
          this.state.state = 'stopped'
          this.targetEndTime = null
        }
      }

      // Handle stopwatch logic
      if (this.state.stopwatchState === 'running' && this.state.stopwatchStartTime) {
        this.state.stopwatchElapsedTime = Date.now() - this.state.stopwatchStartTime
      }

      // Conditional Broadcast: Only if seconds changed
      const currentSecondStr = this.state.currentTime.toISOString().split('.')[0]
      if (
        this.state.remainingTime !== this.lastBroadcastRemaining ||
        currentSecondStr !== this.lastBroadcastTime ||
        this.state.stopwatchState === 'running' // Always broadcast if stopwatch is running
      ) {
        this.broadcastTick()
      }
    }, 100)
  }

  /**
   * Stop the timer interval
   */
  private stopInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Handle timer commands
   */
  handleCommand(command: TimerCommand) {
    switch (command.action) {
      case 'start':
        if (this.state.mode === 'timer' || this.state.mode === 'both') {
          this.state.remainingTime = this.state.originalDuration
          this.state.timerDuration = this.state.originalDuration
          this.state.state = 'running'
          this.targetEndTime = Date.now() + this.state.remainingTime * 1000
        }
        if (this.state.mode === 'clock' || this.state.mode === 'both') {
          this.state.startTime = new Date()
        }
        this.broadcast()
        break

      case 'pause':
        if (this.state.state === 'running') {
          this.state.state = 'paused'
          this.targetEndTime = null
          this.broadcast()
        }
        break

      case 'resume':
        if (this.state.state === 'paused') {
          this.state.state = 'running'
          this.targetEndTime = Date.now() + this.state.remainingTime * 1000
          this.broadcast()
        }
        break

      case 'reset':
        this.state.state = 'stopped'
        this.state.remainingTime = this.state.originalDuration
        this.state.timerDuration = this.state.originalDuration
        this.state.startTime = undefined
        this.targetEndTime = null
        this.broadcast()
        break

      case 'setDuration':
        if (command.duration !== undefined) {
          this.state.originalDuration = command.duration
          if (this.state.state === 'stopped') {
            this.state.timerDuration = command.duration
            this.state.remainingTime = command.duration
          }
          this.broadcast()
        }
        break

      case 'addTime':
        if (command.seconds !== undefined) {
          if (this.state.state === 'stopped') {
            // Add to base duration
            this.state.originalDuration += command.seconds
            this.state.timerDuration = this.state.originalDuration
            this.state.remainingTime = this.state.originalDuration
          } else {
            // Add to remaining time
            this.state.remainingTime += command.seconds
            if (this.state.state === 'running' && this.targetEndTime) {
              this.targetEndTime += command.seconds * 1000
            }
            this.state.timerDuration = Math.max(this.state.timerDuration, this.state.remainingTime)
          }
          this.broadcast()
        }
        break

      case 'removeTime':
        if (command.seconds !== undefined) {
          if (this.state.state === 'stopped') {
            // Remove from base duration
            this.state.originalDuration = Math.max(0, this.state.originalDuration - command.seconds)
            this.state.timerDuration = this.state.originalDuration
            this.state.remainingTime = this.state.originalDuration
          } else {
            // Remove from remaining time
            this.state.remainingTime = Math.max(0, this.state.remainingTime - command.seconds)
            if (this.state.state === 'running' && this.targetEndTime) {
              this.targetEndTime -= command.seconds * 1000
            }
            this.state.timerDuration = Math.max(this.state.timerDuration, this.state.remainingTime)
          }
          this.broadcast()
        }
        break

      case 'setMode':
        if (command.mode !== undefined) {
          this.state.mode = command.mode
          this.broadcast()
        }
        break

      case 'setTimezone':
        if (command.timezone !== undefined) {
          this.state.timezone = command.timezone
          this.broadcast()
        }
        break

      case 'startStopwatch':
        if (this.state.stopwatchState !== 'running') {
          this.state.stopwatchState = 'running'
          this.state.stopwatchStartTime = Date.now() - this.state.stopwatchElapsedTime
          this.broadcast()
        }
        break

      case 'pauseStopwatch':
        if (this.state.stopwatchState === 'running') {
          this.state.stopwatchState = 'paused'
          this.state.stopwatchElapsedTime = Date.now() - (this.state.stopwatchStartTime || 0)
          this.broadcast()
        }
        break

      case 'resetStopwatch':
        this.state.stopwatchState = 'stopped'
        this.state.stopwatchElapsedTime = 0
        this.state.stopwatchStartTime = undefined
        this.broadcast()
        break

      default:
        console.warn('Unknown timer command:', command)
    }
  }

  /**
   * Get current timer state
   */
  getState(): TimerState {
    return { ...this.state }
  }

  /**
   * Initialize timer state from saved settings
   */
  initializeState(initialState: Partial<TimerState>) {
    if (initialState.originalDuration !== undefined) {
      this.state.originalDuration = initialState.originalDuration
      this.state.timerDuration = initialState.originalDuration
      this.state.remainingTime = initialState.originalDuration
    }
    if (initialState.mode !== undefined) {
      this.state.mode = initialState.mode
    }
    if (initialState.timezone !== undefined) {
      this.state.timezone = initialState.timezone
    }
    this.broadcast()
  }

  /**
   * Cleanup: stop interval and clear windows
   */
  cleanup() {
    this.stopInterval()
    this.windows = []
  }
}
