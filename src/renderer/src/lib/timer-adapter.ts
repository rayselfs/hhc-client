import type { WorkerIncomingMessage, WorkerOutgoingMessage } from '@renderer/workers/timer.worker'
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
 * Electron implementation (stub - not yet wired to Electron IPC)
 * Will be implemented in T27
 */
export class ElectronTimerAdapter implements TimerAdapter {
  sendCommand(_cmd: WorkerIncomingMessage): void {
    throw new Error('ElectronTimerAdapter not yet wired — implement in T27')
  }

  onTick(_callback: (remainingMs: number, progress: number) => void): void {
    // stub
  }

  onFinished(_callback: () => void): void {
    // stub
  }

  onStopwatchTick(_callback: (elapsedMs: number) => void): void {
    // stub
  }

  dispose(): void {
    // stub
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
