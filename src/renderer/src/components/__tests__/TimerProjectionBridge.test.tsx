import { renderHook, act } from '@testing-library/react'
import { useTimerStore, DEFAULT_SETTINGS, DEFAULT_STATE } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'

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

import TimerProjectionBridge from '../TimerProjectionBridge'

function renderBridge(): ReturnType<typeof renderHook<null, unknown>> {
  return renderHook(() => null, {
    wrapper: ({ children }) => (
      <>
        <TimerProjectionBridge />
        {children}
      </>
    )
  })
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
    showOnProjection: false
  })
})

describe('TimerProjectionBridge — timer:tick projection', () => {
  it('sends timer:tick on mount with initial state', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderBridge()
    expect(mockProject).toHaveBeenCalledWith(
      'timer:tick',
      expect.objectContaining({
        mode: 'timer',
        phase: 'idle'
      }),
      expect.objectContaining({ autoShow: false })
    )
  })

  it('sends autoShow: true when timer is running', () => {
    useTimerStore.setState({
      mode: 'timer',
      status: 'running',
      totalDuration: 300,
      targetEndTime: Date.now() + 300000
    })
    renderBridge()
    expect(mockProject).toHaveBeenCalledWith(
      'timer:tick',
      expect.objectContaining({ mode: 'timer' }),
      expect.objectContaining({ autoShow: true, autoOpen: true })
    )
  })

  it('sends autoShow: false when timer is stopped', () => {
    useTimerStore.setState({ mode: 'timer', status: 'stopped' })
    renderBridge()
    expect(mockProject).toHaveBeenCalledWith(
      'timer:tick',
      expect.objectContaining({ mode: 'timer' }),
      expect.objectContaining({ autoShow: false, autoOpen: false })
    )
  })

  it('sends mode clock when stopwatch showOnProjection is false', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ showOnProjection: false })
    renderBridge()

    expect(mockProject).toHaveBeenCalledWith(
      'timer:tick',
      expect.objectContaining({ mode: 'clock' }),
      expect.objectContaining({ autoShow: false })
    )
  })
})

describe('TimerProjectionBridge — timer:stopwatch projection', () => {
  it('sends timer:stopwatch when showOnProjection is true', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      showOnProjection: true
    })
    renderBridge()

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

  it('sends updated timer:stopwatch when stopwatch state changes', async () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      showOnProjection: true
    })
    renderBridge()
    mockProject.mockClear()

    await act(async () => {
      useStopwatchStore.setState({
        status: 'running',
        elapsedMs: 1500
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

  it('does not send timer:stopwatch when showOnProjection is false', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      showOnProjection: false
    })
    renderBridge()

    const stopwatchCalls = mockProject.mock.calls.filter(
      (c: unknown[]) => c[0] === 'timer:stopwatch'
    )
    expect(stopwatchCalls).toHaveLength(0)
  })

  it('does not send timer:stopwatch when not in stopwatch mode', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderBridge()

    const stopwatchCalls = mockProject.mock.calls.filter(
      (c: unknown[]) => c[0] === 'timer:stopwatch'
    )
    expect(stopwatchCalls).toHaveLength(0)
  })
})
