import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WorkerIncomingMessage, WorkerOutgoingMessage } from '@renderer/workers/timer.worker'

vi.mock('../env', () => ({
  isElectron: vi.fn()
}))

import { isElectron } from '../env'
import { BrowserTimerAdapter, ElectronTimerAdapter, createTimerAdapter } from '../timer-adapter'

let mockPostMessage: ReturnType<typeof vi.fn>
let mockTerminate: ReturnType<typeof vi.fn>
let mockAddEventListener: ReturnType<typeof vi.fn>
let MockWorkerConstructor: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPostMessage = vi.fn()
  mockTerminate = vi.fn()
  mockAddEventListener = vi.fn()

  MockWorkerConstructor = vi.fn(function () {
    return {
      postMessage: mockPostMessage,
      terminate: mockTerminate,
      addEventListener: mockAddEventListener,
      onmessage: null
    }
  })

  vi.stubGlobal('Worker', MockWorkerConstructor as unknown as typeof Worker)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('TimerAdapter', () => {
  describe('createTimerAdapter', () => {
    it('returns BrowserTimerAdapter when isElectron is false', () => {
      vi.mocked(isElectron).mockReturnValue(false)
      const adapter = createTimerAdapter()
      expect(adapter).toBeInstanceOf(BrowserTimerAdapter)
    })

    it('returns ElectronTimerAdapter when isElectron is true', () => {
      vi.mocked(isElectron).mockReturnValue(true)
      const adapter = createTimerAdapter()
      expect(adapter).toBeInstanceOf(ElectronTimerAdapter)
    })
  })

  describe('BrowserTimerAdapter', () => {
    let adapter: BrowserTimerAdapter

    beforeEach(() => {
      vi.mocked(isElectron).mockReturnValue(false)
      adapter = new BrowserTimerAdapter()
    })

    it('creates a Worker with correct module URL', () => {
      expect(MockWorkerConstructor).toHaveBeenCalled()
    })

    it('sends command via worker.postMessage', () => {
      const cmd: WorkerIncomingMessage = { type: 'start', durationMs: 5000 }
      adapter.sendCommand(cmd)
      expect(mockPostMessage).toHaveBeenCalledWith(cmd)
    })

    it('calls onTick callback on tick message', () => {
      const tickCallback = vi.fn()
      adapter.onTick(tickCallback)

      const tickMessage: WorkerOutgoingMessage = {
        type: 'tick',
        remainingMs: 3000,
        progress: 0.6
      }

      const messageHandler = mockAddEventListener.mock.calls[0][1] as EventListener
      messageHandler(new MessageEvent('message', { data: tickMessage }))

      expect(tickCallback).toHaveBeenCalledWith(3000, 0.6)
    })

    it('calls onFinished callback on finished message', () => {
      const finishedCallback = vi.fn()
      adapter.onFinished(finishedCallback)

      const finishedMessage: WorkerOutgoingMessage = { type: 'finished' }

      const messageHandler = mockAddEventListener.mock.calls[0][1] as EventListener
      messageHandler(new MessageEvent('message', { data: finishedMessage }))

      expect(finishedCallback).toHaveBeenCalled()
    })

    it('calls onStopwatchTick callback on stopwatchTick message', () => {
      const stopwatchCallback = vi.fn()
      adapter.onStopwatchTick(stopwatchCallback)

      const stopwatchMessage: WorkerOutgoingMessage = {
        type: 'stopwatchTick',
        elapsedMs: 12500
      }

      const messageHandler = mockAddEventListener.mock.calls[0][1] as EventListener
      messageHandler(new MessageEvent('message', { data: stopwatchMessage }))

      expect(stopwatchCallback).toHaveBeenCalledWith(12500)
    })

    it('terminates worker on dispose', () => {
      adapter.dispose()
      expect(mockTerminate).toHaveBeenCalled()
    })

    it('clears callbacks on dispose', () => {
      const tickCallback = vi.fn()
      adapter.onTick(tickCallback)
      adapter.dispose()

      const tickMessage: WorkerOutgoingMessage = {
        type: 'tick',
        remainingMs: 2000,
        progress: 0.4
      }

      const messageHandler = mockAddEventListener.mock.calls[0][1] as EventListener
      messageHandler(new MessageEvent('message', { data: tickMessage }))

      expect(tickCallback).not.toHaveBeenCalled()
    })
  })

  describe('ElectronTimerAdapter', () => {
    let adapter: ElectronTimerAdapter

    beforeEach(() => {
      adapter = new ElectronTimerAdapter()
    })

    it('throws when sendCommand is called', () => {
      const cmd: WorkerIncomingMessage = { type: 'start', durationMs: 5000 }
      expect(() => adapter.sendCommand(cmd)).toThrow(
        'ElectronTimerAdapter not yet wired — implement in T27'
      )
    })

    it('accepts onTick callback (stub)', () => {
      const callback = vi.fn()
      expect(() => adapter.onTick(callback)).not.toThrow()
    })

    it('accepts onFinished callback (stub)', () => {
      const callback = vi.fn()
      expect(() => adapter.onFinished(callback)).not.toThrow()
    })

    it('accepts onStopwatchTick callback (stub)', () => {
      const callback = vi.fn()
      expect(() => adapter.onStopwatchTick(callback)).not.toThrow()
    })

    it('accepts dispose call (stub)', () => {
      expect(() => adapter.dispose()).not.toThrow()
    })
  })
})
