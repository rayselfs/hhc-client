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
    let mockTimerCommand: ReturnType<typeof vi.fn>
    let mockOnTimerTick: ReturnType<typeof vi.fn>
    let mockCleanup: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockTimerCommand = vi.fn()
      mockCleanup = vi.fn()
      mockOnTimerTick = vi.fn().mockReturnValue(mockCleanup)

      vi.stubGlobal('window', {
        api: {
          timer: {
            timerCommand: mockTimerCommand,
            onTimerTick: mockOnTimerTick,
            timerGetState: vi.fn(),
            timerInitialize: vi.fn()
          }
        }
      })

      adapter = new ElectronTimerAdapter()
    })

    it('sendCommand calls window.api.timer.timerCommand', () => {
      const cmd: WorkerIncomingMessage = { type: 'start', durationMs: 5000 }
      adapter.sendCommand(cmd)
      expect(mockTimerCommand).toHaveBeenCalledWith({ type: 'start' })
    })

    it('sendCommand maps addTime ms to seconds', () => {
      const cmd: WorkerIncomingMessage = { type: 'addTime', ms: 30000 }
      adapter.sendCommand(cmd)
      expect(mockTimerCommand).toHaveBeenCalledWith({ type: 'addTime', seconds: 30 })
    })

    it('sendCommand maps removeTime ms to seconds', () => {
      const cmd: WorkerIncomingMessage = { type: 'removeTime', ms: 10000 }
      adapter.sendCommand(cmd)
      expect(mockTimerCommand).toHaveBeenCalledWith({ type: 'removeTime', seconds: 10 })
    })

    it('onTick registers via window.api.timer.onTimerTick', () => {
      const tickCb = vi.fn()
      adapter.onTick(tickCb)
      expect(mockOnTimerTick).toHaveBeenCalledOnce()
    })

    it('onTick callback receives remainingMs and progress from payload', () => {
      const tickCb = vi.fn()
      adapter.onTick(tickCb)

      const payloadHandler = mockOnTimerTick.mock.calls[0][0]
      payloadHandler({
        mode: 'timer',
        remainingSeconds: 90,
        phase: 'main',
        mainDisplay: '01:30',
        subDisplay: null,
        progress: 0.5,
        overtimeSeconds: 0,
        overtimeMessage: null
      })

      expect(tickCb).toHaveBeenCalledWith(90000, 0.5)
    })

    it('onFinished fires when phase transitions to overtime', () => {
      const finishedCb = vi.fn()
      adapter.onFinished(finishedCb)

      const payloadHandler = mockOnTimerTick.mock.calls[0][0]

      payloadHandler({
        mode: 'timer',
        remainingSeconds: 0,
        phase: 'overtime',
        mainDisplay: '00:00',
        subDisplay: null,
        progress: 1,
        overtimeSeconds: 1,
        overtimeMessage: null
      })

      expect(finishedCb).toHaveBeenCalledOnce()
    })

    it('onFinished does not fire again on repeated overtime ticks', () => {
      const finishedCb = vi.fn()
      adapter.onFinished(finishedCb)

      const payloadHandler = mockOnTimerTick.mock.calls[0][0]
      const overtimePayload = {
        mode: 'timer' as const,
        remainingSeconds: 0,
        phase: 'overtime' as const,
        mainDisplay: '00:00',
        subDisplay: null,
        progress: 1,
        overtimeSeconds: 2,
        overtimeMessage: null
      }

      payloadHandler(overtimePayload)
      payloadHandler({ ...overtimePayload, overtimeSeconds: 3 })

      expect(finishedCb).toHaveBeenCalledOnce()
    })

    it('onStopwatchTick fires when mode is stopwatch', () => {
      const stopwatchCb = vi.fn()
      adapter.onStopwatchTick(stopwatchCb)

      const payloadHandler = mockOnTimerTick.mock.calls[0][0]
      payloadHandler({
        mode: 'stopwatch',
        remainingSeconds: 0,
        phase: 'idle',
        mainDisplay: '00:00',
        subDisplay: null,
        progress: 0,
        overtimeSeconds: 0,
        overtimeMessage: null
      })

      expect(stopwatchCb).toHaveBeenCalledWith(0)
    })

    it('onTimerTick listener is registered only once across multiple registrations', () => {
      adapter.onTick(vi.fn())
      adapter.onFinished(vi.fn())
      adapter.onStopwatchTick(vi.fn())
      expect(mockOnTimerTick).toHaveBeenCalledOnce()
    })

    it('dispose calls cleanup fn returned by onTimerTick', () => {
      adapter.onTick(vi.fn())
      adapter.dispose()
      expect(mockCleanup).toHaveBeenCalledOnce()
    })

    it('dispose clears callbacks so no further ticks fire', () => {
      const tickCb = vi.fn()
      adapter.onTick(tickCb)

      const payloadHandler = mockOnTimerTick.mock.calls[0][0]
      adapter.dispose()

      payloadHandler({
        mode: 'timer',
        remainingSeconds: 60,
        phase: 'main',
        mainDisplay: '01:00',
        subDisplay: null,
        progress: 0.3,
        overtimeSeconds: 0,
        overtimeMessage: null
      })

      expect(tickCb).not.toHaveBeenCalled()
    })
  })
})
