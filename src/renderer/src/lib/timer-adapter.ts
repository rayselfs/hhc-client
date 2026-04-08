import type { WorkerIncomingMessage, WorkerOutgoingMessage } from '@renderer/workers/timer.worker'
import type { TimerCommand } from '@shared/types/timer'
import { isElectron } from './env'

/**
 * TimerAdapter interface - abstraction for timing engine communication
 * Bridges Zustand stores ↔ Web Worker (browser) or Electron IPC (future)
 */
export interface TimerAdapter {
  /** Send a command to the timing engine */
  sendCommand(cmd: WorkerIncomingMessage): void

  /** Register callback for countdown tick events */
  onTick(callback: (remainingMs: number, progress: number) => void): void

  /** Register callback for finished event */
  onFinished(callback: () => void): void

  /** Register callback for stopwatch tick events */
  onStopwatchTick(callback: (elapsedMs: number) => void): void

  /** Clean up worker/listeners */
  dispose(): void
}

/**
 * Browser implementation - wraps Web Worker
 */
export class BrowserTimerAdapter implements TimerAdapter {
  private worker: Worker
  private tickCallback: ((remainingMs: number, progress: number) => void) | null = null
  private finishedCallback: (() => void) | null = null
  private stopwatchTickCallback: ((elapsedMs: number) => void) | null = null

  constructor() {
    this.worker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url), {
      type: 'module'
    })
    this.setupMessageHandler()
  }

  private setupMessageHandler(): void {
    this.worker.addEventListener('message', (event: MessageEvent<WorkerOutgoingMessage>) => {
      const { data } = event
      switch (data.type) {
        case 'tick':
          if (this.tickCallback) {
            this.tickCallback(data.remainingMs, data.progress)
          }
          break
        case 'finished':
          if (this.finishedCallback) {
            this.finishedCallback()
          }
          break
        case 'stopwatchTick':
          if (this.stopwatchTickCallback) {
            this.stopwatchTickCallback(data.elapsedMs)
          }
          break
      }
    })
  }

  sendCommand(cmd: WorkerIncomingMessage): void {
    this.worker.postMessage(cmd)
  }

  onTick(callback: (remainingMs: number, progress: number) => void): void {
    this.tickCallback = callback
  }

  onFinished(callback: () => void): void {
    this.finishedCallback = callback
  }

  onStopwatchTick(callback: (elapsedMs: number) => void): void {
    this.stopwatchTickCallback = callback
  }

  dispose(): void {
    this.worker.terminate()
    this.tickCallback = null
    this.finishedCallback = null
    this.stopwatchTickCallback = null
  }
}

/**
 * Maps a WorkerIncomingMessage (renderer-worker protocol) to a TimerCommand (IPC protocol).
 * The worker uses ms-based units; IPC uses seconds-based units.
 */
function toTimerCommand(cmd: WorkerIncomingMessage): TimerCommand {
  switch (cmd.type) {
    case 'start':
      return { type: 'start' }
    case 'pause':
      return { type: 'pause' }
    case 'resume':
      return { type: 'resume' }
    case 'reset':
      return { type: 'reset' }
    case 'addTime':
      return { type: 'addTime', seconds: cmd.ms / 1000 }
    case 'removeTime':
      return { type: 'removeTime', seconds: cmd.ms / 1000 }
    case 'startStopwatch':
      return { type: 'startStopwatch' }
    case 'pauseStopwatch':
      return { type: 'pauseStopwatch' }
    case 'resumeStopwatch':
      // IPC has no resumeStopwatch — map to startStopwatch (main process handles resume internally)
      return { type: 'startStopwatch' }
    case 'resetStopwatch':
      return { type: 'resetStopwatch' }
  }
}

/**
 * Electron implementation - bridges TimerAdapter to window.api.timer IPC
 */
export class ElectronTimerAdapter implements TimerAdapter {
  private cleanupTick: (() => void) | null = null
  private tickCallback: ((remainingMs: number, progress: number) => void) | null = null
  private finishedCallback: (() => void) | null = null
  private stopwatchTickCallback: ((elapsedMs: number) => void) | null = null
  private prevPhase: string | null = null

  sendCommand(cmd: WorkerIncomingMessage): void {
    window.api.timer.timerCommand(toTimerCommand(cmd))
  }

  onTick(callback: (remainingMs: number, progress: number) => void): void {
    this.tickCallback = callback
    this.ensureTickListener()
  }

  onFinished(callback: () => void): void {
    this.finishedCallback = callback
    this.ensureTickListener()
  }

  onStopwatchTick(callback: (elapsedMs: number) => void): void {
    this.stopwatchTickCallback = callback
    this.ensureTickListener()
  }

  /**
   * Sets up the single onTimerTick listener.
   * Routes tick payload to tick, finished, and stopwatchTick callbacks.
   * Only registers once — subsequent calls are no-ops.
   */
  private ensureTickListener(): void {
    if (this.cleanupTick) return

    this.cleanupTick = window.api.timer.onTimerTick((payload) => {
      const remainingMs = payload.remainingSeconds * 1000
      const { progress, phase, mode } = payload

      // Countdown tick
      if (this.tickCallback) {
        this.tickCallback(remainingMs, progress)
      }

      // Finished: fire once when transitioning into overtime
      if (this.finishedCallback && phase === 'overtime' && this.prevPhase !== 'overtime') {
        this.finishedCallback()
      }

      // Stopwatch tick: fire when mode is stopwatch
      if (this.stopwatchTickCallback && mode === 'stopwatch') {
        this.stopwatchTickCallback(payload.stopwatchElapsedMs ?? 0)
      }

      this.prevPhase = phase
    })
  }

  dispose(): void {
    if (this.cleanupTick) {
      this.cleanupTick()
      this.cleanupTick = null
    }
    this.tickCallback = null
    this.finishedCallback = null
    this.stopwatchTickCallback = null
    this.prevPhase = null
  }
}

/**
 * Factory function - returns appropriate adapter based on environment
 */
export function createTimerAdapter(): TimerAdapter {
  if (isElectron()) {
    return new ElectronTimerAdapter()
  }
  return new BrowserTimerAdapter()
}
