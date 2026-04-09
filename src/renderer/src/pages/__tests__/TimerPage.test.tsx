import { render, screen, act } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import { useTimerStore, DEFAULT_SETTINGS, DEFAULT_STATE } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'

const mockDispose = vi.fn()
const mockOnTick = vi.fn()
const mockOnFinished = vi.fn()
const mockOnStopwatchTick = vi.fn()
const mockSendCommand = vi.fn()

vi.mock('@renderer/lib/timer-adapter', () => ({
  createTimerAdapter: vi.fn(() => ({
    onTick: mockOnTick,
    onFinished: mockOnFinished,
    onStopwatchTick: mockOnStopwatchTick,
    sendCommand: mockSendCommand,
    dispose: mockDispose
  }))
}))

const mockProject = vi.fn()

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: vi.fn(() => ({
    project: mockProject,
    isProjectionOpen: false,
    isProjectionBlanked: true,
    openProjection: vi.fn(),
    closeProjection: vi.fn(),
    blankProjection: vi.fn(),
    send: vi.fn(),
    on: vi.fn()
  }))
}))

import TimerPage from '../TimerPage'

function renderTimerPage(): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <TimerPage />
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
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
    accumulatedMs: 0,
    formattedTime: '00:00.00',
    elapsedSeconds: 0
  })
})

describe('TimerPage — TIMER mode', () => {
  it('renders TimerDisplay (SVG ring) in timer mode', () => {
    useTimerStore.setState({ mode: 'timer' })
    const { container } = renderTimerPage()
    expect(container.querySelector('svg circle')).toBeInTheDocument()
  })

  it('renders TimerControls start button in timer mode', () => {
    useTimerStore.setState({ mode: 'timer', status: 'stopped' })
    renderTimerPage()
    expect(screen.getByTestId('btn-start')).toBeInTheDocument()
  })

  it('does not render ClockDisplay in timer mode', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderTimerPage()
    expect(screen.queryByTestId('clock-display')).not.toBeInTheDocument()
  })

  it('does not render StopwatchDisplay in timer mode', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderTimerPage()
    expect(screen.queryByTestId('stopwatch-display')).not.toBeInTheDocument()
  })
})

describe('TimerPage — CLOCK mode', () => {
  it('renders TimerDisplay (SVG ring) in clock mode', () => {
    useTimerStore.setState({ mode: 'clock' })
    const { container } = renderTimerPage()
    expect(container.querySelector('svg circle')).toBeInTheDocument()
  })

  it('renders TimerControls with disabled start in clock mode', () => {
    useTimerStore.setState({ mode: 'clock', status: 'stopped' })
    renderTimerPage()
    expect(screen.getByTestId('btn-start')).toBeDisabled()
  })

  it('does not render ClockDisplay in clock mode (only on projection)', () => {
    useTimerStore.setState({ mode: 'clock' })
    renderTimerPage()
    expect(screen.queryByTestId('clock-display')).not.toBeInTheDocument()
  })
})

describe('TimerPage — BOTH mode', () => {
  it('renders TimerDisplay (SVG ring) in both mode', () => {
    useTimerStore.setState({ mode: 'both' })
    const { container } = renderTimerPage()
    expect(container.querySelector('svg circle')).toBeInTheDocument()
  })

  it('renders TimerControls start button in both mode', () => {
    useTimerStore.setState({ mode: 'both', status: 'stopped' })
    renderTimerPage()
    expect(screen.getByTestId('btn-start')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start')).not.toBeDisabled()
  })

  it('does not render ClockDisplay in both mode (only on projection)', () => {
    useTimerStore.setState({ mode: 'both' })
    renderTimerPage()
    expect(screen.queryByTestId('clock-display')).not.toBeInTheDocument()
  })

  it('does not render StopwatchDisplay in both mode', () => {
    useTimerStore.setState({ mode: 'both' })
    renderTimerPage()
    expect(screen.queryByTestId('stopwatch-display')).not.toBeInTheDocument()
  })
})

describe('TimerPage — STOPWATCH mode', () => {
  it('renders StopwatchDisplay in stopwatch mode', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    renderTimerPage()
    expect(screen.getByTestId('stopwatch-display')).toBeInTheDocument()
  })

  it('renders TimerControls (start button) in stopwatch mode', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    renderTimerPage()
    expect(screen.getByTestId('btn-start')).toBeInTheDocument()
  })

  it('does not render progressbar in stopwatch mode', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    const { container } = renderTimerPage()
    expect(container.querySelectorAll('circle')).toHaveLength(0)
  })

  it('displays formatted stopwatch time from store', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ formattedTime: '01:23' })
    renderTimerPage()
    expect(screen.getByText('01:23')).toBeInTheDocument()
  })
})

describe('TimerPage — adapter lifecycle', () => {
  it('calls adapter.dispose on unmount', () => {
    const { unmount } = renderTimerPage()
    unmount()
    expect(mockDispose).toHaveBeenCalledOnce()
  })

  it('registers onTick, onFinished, onStopwatchTick callbacks on mount', () => {
    renderTimerPage()
    expect(mockOnTick).toHaveBeenCalledOnce()
    expect(mockOnFinished).toHaveBeenCalledOnce()
    expect(mockOnStopwatchTick).toHaveBeenCalledOnce()
  })
})

describe('TimerPage — projection data flow', () => {
  it('calls project("timer:tick", ...) on mount with initial state', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderTimerPage()
    expect(mockProject).toHaveBeenCalledWith(
      'timer:tick',
      expect.objectContaining({
        mode: 'timer',
        phase: 'idle'
      }),
      expect.objectContaining({ autoShow: false })
    )
  })
})

describe('TimerPage — adapter command relay (timer)', () => {
  it('sends start command when timer status transitions stopped→running', async () => {
    useTimerStore.setState({ mode: 'timer', status: 'stopped', totalDuration: 300 })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useTimerStore.getState().start()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'start', durationMs: 300000 })
  })

  it('sends pause command when timer status transitions running→paused', async () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'running',
      totalDuration: 300,
      targetEndTime: Date.now() + 300000
    })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useTimerStore.getState().pause()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'pause' })
  })

  it('sends resume command when timer status transitions paused→running', async () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'paused',
      totalDuration: 300,
      remainingSeconds: 200
    })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useTimerStore.getState().resume()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'resume' })
  })

  it('sends reset command when timer status transitions running→stopped', async () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'running',
      totalDuration: 300,
      targetEndTime: Date.now() + 300000
    })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useTimerStore.getState().reset()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'reset' })
  })

  it('sends reset command when timer status transitions paused→stopped', async () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'paused',
      totalDuration: 300,
      remainingSeconds: 200
    })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useTimerStore.getState().reset()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'reset' })
  })

  it('does not send command on initial render when status is stopped', () => {
    useTimerStore.setState({ mode: 'timer', status: 'stopped' })
    renderTimerPage()
    expect(mockSendCommand).not.toHaveBeenCalled()
  })
})

describe('TimerPage — adapter command relay (stopwatch)', () => {
  it('sends startStopwatch command when stopwatch transitions stopped→running', async () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ status: 'stopped' })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useStopwatchStore.getState().start()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'startStopwatch' })
  })

  it('sends pauseStopwatch command when stopwatch transitions running→paused', async () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ status: 'running', startTimestamp: Date.now() })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useStopwatchStore.getState().pause()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'pauseStopwatch' })
  })

  it('sends resumeStopwatch command when stopwatch transitions paused→running', async () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ status: 'paused', accumulatedMs: 5000 })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useStopwatchStore.getState().resume()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'resumeStopwatch' })
  })

  it('sends resetStopwatch command when stopwatch transitions running→stopped', async () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ status: 'running', startTimestamp: Date.now() })
    renderTimerPage()
    mockSendCommand.mockClear()

    await act(async () => {
      useStopwatchStore.getState().reset()
    })

    expect(mockSendCommand).toHaveBeenCalledWith({ type: 'resetStopwatch' })
  })
})

describe('TimerPage — TimeInputPopover gating', () => {
  it('timer display is editable when timer is stopped', () => {
    useTimerStore.setState({ mode: 'timer', status: 'stopped' })
    renderTimerPage()
    expect(screen.getByRole('button', { name: /set timer duration/i })).toBeInTheDocument()
  })

  it('timer display is NOT editable when timer is running', () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'running',
      totalDuration: 300,
      targetEndTime: Date.now() + 300000
    })
    renderTimerPage()
    expect(screen.queryByRole('button', { name: /set timer duration/i })).not.toBeInTheDocument()
  })

  it('timer display is NOT editable when timer is paused', () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'paused',
      totalDuration: 300,
      remainingSeconds: 200
    })
    renderTimerPage()
    expect(screen.queryByRole('button', { name: /set timer duration/i })).not.toBeInTheDocument()
  })

  it('timer display IS editable in clock mode when stopped', () => {
    useTimerStore.setState({ mode: 'clock', status: 'stopped' })
    renderTimerPage()
    expect(screen.getByRole('button', { name: /set timer duration/i })).toBeInTheDocument()
  })
})

describe('TimerPage — stopwatch projection', () => {
  it('sends timer:stopwatch projection when showOnProjection is true', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      formattedTime: '00:00',
      showOnProjection: true
    })
    renderTimerPage()

    expect(mockProject).toHaveBeenCalledWith(
      'timer:stopwatch',
      expect.objectContaining({
        elapsedMs: 0,
        formattedTime: '00:00',
        status: 'stopped'
      }),
      expect.objectContaining({ autoShow: false })
    )
  })

  it('sends updated timer:stopwatch projection when stopwatch state changes', async () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      formattedTime: '00:00',
      showOnProjection: true
    })
    renderTimerPage()
    mockProject.mockClear()

    await act(async () => {
      useStopwatchStore.setState({
        status: 'running',
        elapsedMs: 1500,
        formattedTime: '00:01'
      })
    })

    expect(mockProject).toHaveBeenCalledWith(
      'timer:stopwatch',
      expect.objectContaining({
        elapsedMs: 1500,
        formattedTime: '00:01',
        status: 'running'
      }),
      expect.objectContaining({ autoShow: true })
    )
  })

  it('does not send timer:stopwatch projection when showOnProjection is false', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      formattedTime: '00:00',
      showOnProjection: false
    })
    renderTimerPage()

    const stopwatchCalls = mockProject.mock.calls.filter((c) => c[0] === 'timer:stopwatch')
    expect(stopwatchCalls).toHaveLength(0)
  })

  it('sends mode clock to projection when stopwatch showOnProjection is false', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ showOnProjection: false })
    renderTimerPage()

    expect(mockProject).toHaveBeenCalledWith(
      'timer:tick',
      expect.objectContaining({ mode: 'clock' }),
      expect.objectContaining({ autoShow: false })
    )
  })

  it('does not send timer:stopwatch projection when not in stopwatch mode', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderTimerPage()

    const stopwatchCalls = mockProject.mock.calls.filter((c) => c[0] === 'timer:stopwatch')
    expect(stopwatchCalls).toHaveLength(0)
  })
})
