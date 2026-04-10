import { render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import { useTimerStore, DEFAULT_SETTINGS, DEFAULT_STATE } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'

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
    accumulatedMs: 0
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
    useStopwatchStore.setState({ elapsedMs: 83000 })
    renderTimerPage()
    expect(screen.getByText('01:23')).toBeInTheDocument()
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
