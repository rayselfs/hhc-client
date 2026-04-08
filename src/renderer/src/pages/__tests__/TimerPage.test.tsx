import { render, screen } from '@testing-library/react'
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

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react')
  return {
    ...actual,
    Modal: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
      Root: ({ state, children }: { state?: { isOpen: boolean }; children: React.ReactNode }) =>
        state?.isOpen ? <div>{children}</div> : null,
      Trigger: () => null,
      Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Heading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Icon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CloseTrigger: () => null
    }),
    useOverlayState: ({
      isOpen,
      onOpenChange
    }: {
      isOpen?: boolean
      onOpenChange?: (open: boolean) => void
    }) => ({
      isOpen: isOpen ?? false,
      setOpen: (v: boolean) => onOpenChange?.(v),
      open: () => onOpenChange?.(true),
      close: () => onOpenChange?.(false),
      toggle: () => onOpenChange?.(!isOpen)
    })
  }
})

import TimerPage from '../TimerPage'

function renderTimerPage() {
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
  it('renders ModeSelector with all 4 mode tabs', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderTimerPage()
    expect(screen.getByTestId('mode-timer')).toBeInTheDocument()
    expect(screen.getByTestId('mode-clock')).toBeInTheDocument()
    expect(screen.getByTestId('mode-both')).toBeInTheDocument()
    expect(screen.getByTestId('mode-stopwatch')).toBeInTheDocument()
  })

  it('renders TimerDisplay (progressbar) in timer mode', () => {
    useTimerStore.setState({ mode: 'timer' })
    renderTimerPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
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
  it('renders ClockDisplay in clock mode', () => {
    useTimerStore.setState({ mode: 'clock' })
    renderTimerPage()
    expect(screen.getByTestId('clock-display')).toBeInTheDocument()
  })

  it('does not render TimerControls (start button) in clock mode', () => {
    useTimerStore.setState({ mode: 'clock' })
    renderTimerPage()
    expect(screen.queryByTestId('btn-start')).not.toBeInTheDocument()
  })

  it('does not render progressbar in clock mode', () => {
    useTimerStore.setState({ mode: 'clock' })
    renderTimerPage()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('TimerPage — BOTH mode', () => {
  it('renders both TimerDisplay and ClockDisplay in both mode', () => {
    useTimerStore.setState({ mode: 'both' })
    renderTimerPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByTestId('clock-display')).toBeInTheDocument()
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
    renderTimerPage()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('displays formatted stopwatch time from store', () => {
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({ formattedTime: '01:23.45' })
    renderTimerPage()
    expect(screen.getByText('01:23.45')).toBeInTheDocument()
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
      })
    )
  })
})
