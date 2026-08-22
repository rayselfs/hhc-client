import { render, renderHook, act } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { TimerEngineProvider, useTimerEngine } from '../TimerEngineContext'
import { useTimerStore, DEFAULT_SETTINGS, DEFAULT_STATE } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import * as timerAdapterModule from '@renderer/lib/timer-adapter'
import * as envModule from '@renderer/lib/env'

vi.mock('@renderer/lib/timer-adapter')
vi.mock('@renderer/lib/env')

const mockAdapter = {
  sendCommand: vi.fn(),
  onTick: vi.fn(),
  onFinished: vi.fn(),
  onStopwatchTick: vi.fn(),
  dispose: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(timerAdapterModule.createTimerAdapter).mockReturnValue(mockAdapter)
  vi.mocked(envModule.isElectron).mockReturnValue(false)

  useTimerStore.setState({
    ...DEFAULT_SETTINGS,
    ...DEFAULT_STATE,
    targetEndTime: null,
    presets: []
  })
  useStopwatchStore.setState({
    status: 'stopped',
    elapsedMs: 0,
    startTimestamp: null,
    accumulatedMs: 0
  })
})

function TestChild(): React.JSX.Element {
  const adapter = useTimerEngine()
  return <div data-testid="child">{adapter ? 'has-adapter' : 'no-adapter'}</div>
}

describe('TimerEngineContext', () => {
  describe('Adapter lifecycle', () => {
    it('creates adapter on mount', () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )
      expect(vi.mocked(timerAdapterModule.createTimerAdapter)).toHaveBeenCalledOnce()
    })

    it('disposes adapter on unmount', () => {
      const { unmount } = render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )
      expect(mockAdapter.dispose).not.toHaveBeenCalled()
      unmount()
      expect(mockAdapter.dispose).toHaveBeenCalledOnce()
    })

    it('disposes each adapter created during a StrictMode remount', () => {
      const { unmount } = render(
        <StrictMode>
          <TimerEngineProvider>
            <TestChild />
          </TimerEngineProvider>
        </StrictMode>
      )

      unmount()

      expect(timerAdapterModule.createTimerAdapter).toHaveBeenCalledTimes(2)
      expect(mockAdapter.dispose).toHaveBeenCalledTimes(2)
    })
  })

  describe('Callback registration', () => {
    it('registers onTick callback', () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )
      expect(mockAdapter.onTick).toHaveBeenCalledOnce()
      expect(typeof mockAdapter.onTick.mock.calls[0][0]).toBe('function')
    })

    it('registers onFinished callback', () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )
      expect(mockAdapter.onFinished).toHaveBeenCalledOnce()
      expect(typeof mockAdapter.onFinished.mock.calls[0][0]).toBe('function')
    })

    it('registers onStopwatchTick callback', () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )
      expect(mockAdapter.onStopwatchTick).toHaveBeenCalledOnce()
      expect(typeof mockAdapter.onStopwatchTick.mock.calls[0][0]).toBe('function')
    })
  })

  describe('Timer command relay — stopped to running', () => {
    it('sends start command when timer transitions from stopped to running', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useTimerStore.getState().start()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({
        type: 'start',
        durationMs: 300000
      })
    })

    it('uses correct totalDuration from store', async () => {
      useTimerStore.setState({ totalDuration: 600 })

      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useTimerStore.getState().start()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({
        type: 'start',
        durationMs: 600000
      })
    })
  })

  describe('Timer command relay — running to paused', () => {
    it('sends pause command when timer transitions from running to paused', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useTimerStore.getState().start()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useTimerStore.getState().pause()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'pause' })
    })
  })

  describe('Timer command relay — paused to running', () => {
    it('sends resume command when timer transitions from paused to running', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useTimerStore.getState().start()
      })

      await act(async () => {
        useTimerStore.getState().pause()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useTimerStore.getState().resume()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'resume' })
    })
  })

  describe('Timer command relay — any to stopped', () => {
    it('sends reset command when timer transitions from running to stopped', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useTimerStore.getState().start()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useTimerStore.getState().reset()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'reset' })
    })

    it('sends reset command when timer transitions from paused to stopped', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useTimerStore.getState().start()
      })

      await act(async () => {
        useTimerStore.getState().pause()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useTimerStore.getState().reset()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'reset' })
    })
  })

  describe('Timer command relay — initial render', () => {
    it('does not send command on initial render when status is stopped', () => {
      useTimerStore.setState({ status: 'stopped' })

      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      expect(mockAdapter.sendCommand).not.toHaveBeenCalled()
    })
  })

  describe('Stopwatch command relay — stopped to running', () => {
    it('sends startStopwatch command when stopwatch transitions from stopped to running', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'startStopwatch' })
    })
  })

  describe('Stopwatch command relay — running to paused', () => {
    it('sends pauseStopwatch command when stopwatch transitions from running to paused', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useStopwatchStore.getState().pause()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'pauseStopwatch' })
    })
  })

  describe('Stopwatch command relay — paused to running', () => {
    it('sends resumeStopwatch command when stopwatch transitions from paused to running', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      await act(async () => {
        useStopwatchStore.getState().pause()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useStopwatchStore.getState().resume()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'resumeStopwatch' })
    })
  })

  describe('Stopwatch command relay — any to stopped', () => {
    it('sends resetStopwatch command when stopwatch transitions from running to stopped', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useStopwatchStore.getState().reset()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'resetStopwatch' })
    })

    it('sends resetStopwatch command when stopwatch transitions from paused to stopped', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      await act(async () => {
        useStopwatchStore.getState().pause()
      })

      mockAdapter.sendCommand.mockClear()

      await act(async () => {
        useStopwatchStore.getState().reset()
      })

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith({ type: 'resetStopwatch' })
    })
  })

  describe('Stopwatch tick source', () => {
    it('updates stopwatch only from the adapter callback', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      const tickSpy = vi.spyOn(useStopwatchStore.getState(), 'tick')
      const callback = mockAdapter.onStopwatchTick.mock.calls[0][0]

      await act(async () => {
        callback()
      })

      expect(tickSpy).toHaveBeenCalledOnce()
    })

    it('does not create a renderer interval when stopwatch starts', async () => {
      render(
        <TimerEngineProvider>
          <TestChild />
        </TimerEngineProvider>
      )

      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      await act(async () => {
        useStopwatchStore.getState().start()
      })

      expect(setIntervalSpy).not.toHaveBeenCalled()
    })
  })

  describe('useTimerEngine hook', () => {
    it('returns null when used outside provider', () => {
      const { result } = renderHook(() => useTimerEngine())
      expect(result.current).toBeNull()
    })
  })
})
