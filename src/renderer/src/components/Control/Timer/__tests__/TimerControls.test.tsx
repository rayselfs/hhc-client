import { render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { vi } from 'vitest'
import i18n from '@renderer/i18n'
import TimerControls from '@renderer/components/Control/Timer/TimerControls'
import { useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'

const mockStartProjection = vi.fn(() => Promise.resolve())

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: vi.fn(() => ({
    claimProjection: vi.fn(),
    startProjection: mockStartProjection,
    stopProjection: vi.fn(),
    project: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    isProjectionOpen: false,
    projectionReadyCount: 0,
    activeOwner: 'timer',
    closeProjection: vi.fn()
  }))
}))

beforeEach(() => {
  useTimerStore.setState({ status: 'stopped' })
  useStopwatchStore.setState({ status: 'stopped' })
  mockStartProjection.mockClear()
})

function renderWithI18n(mode: 'timer' | 'clock' | 'both' | 'stopwatch' = 'timer'): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <TimerControls mode={mode} />
    </I18nextProvider>
  )
}

describe('TimerControls — timer mode', () => {
  it('stopped state: shows Start and disabled Reset', () => {
    renderWithI18n('timer')
    expect(screen.getByTestId('btn-start')).toBeInTheDocument()
    expect(screen.queryByTestId('btn-pause')).not.toBeInTheDocument()
    expect(screen.queryByTestId('btn-resume')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeDisabled()
  })

  it('overtime state: Reset is enabled', () => {
    useTimerStore.setState({ status: 'stopped', phase: 'overtime' })
    renderWithI18n('timer')
    expect(screen.getByTestId('btn-reset')).not.toBeDisabled()
  })

  it('running state: shows Pause + Reset, hides Start', () => {
    useTimerStore.setState({ status: 'running' })
    renderWithI18n('timer')
    expect(screen.queryByTestId('btn-start')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-pause')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).not.toBeDisabled()
    expect(screen.queryByTestId('btn-resume')).not.toBeInTheDocument()
  })

  it('paused state: shows Resume + Reset, hides Start', () => {
    useTimerStore.setState({ status: 'paused' })
    renderWithI18n('timer')
    expect(screen.queryByTestId('btn-start')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-resume')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
    expect(screen.queryByTestId('btn-pause')).not.toBeInTheDocument()
  })

  it('clicking Start calls timerStore.start()', async () => {
    const user = userEvent.setup()
    const startSpy = vi.fn()
    useTimerStore.setState({ start: startSpy } as never)
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-start'))
    expect(startSpy).toHaveBeenCalledOnce()
  })

  it('clicking Pause calls timerStore.pause()', async () => {
    const user = userEvent.setup()
    const pauseSpy = vi.fn()
    useTimerStore.setState({ status: 'running', pause: pauseSpy } as never)
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-pause'))
    expect(pauseSpy).toHaveBeenCalledOnce()
  })

  it('clicking Resume calls timerStore.resume()', async () => {
    const user = userEvent.setup()
    const resumeSpy = vi.fn()
    useTimerStore.setState({ status: 'paused', resume: resumeSpy } as never)
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-resume'))
    expect(resumeSpy).toHaveBeenCalledOnce()
  })

  it('clicking Reset calls timerStore.reset()', async () => {
    const user = userEvent.setup()
    const resetSpy = vi.fn()
    useTimerStore.setState({ status: 'running', reset: resetSpy } as never)
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-reset'))
    expect(resetSpy).toHaveBeenCalledOnce()
  })
})

describe('TimerControls — stopwatch mode', () => {
  it('stopped state: shows Start and disabled Reset', () => {
    renderWithI18n('stopwatch')
    expect(screen.getByTestId('btn-start')).toBeInTheDocument()
    expect(screen.queryByTestId('btn-pause')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeDisabled()
  })

  it('running state: shows Pause + Reset', () => {
    useStopwatchStore.setState({ status: 'running' })
    renderWithI18n('stopwatch')
    expect(screen.queryByTestId('btn-start')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-pause')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
  })

  it('paused state: shows Resume + Reset', () => {
    useStopwatchStore.setState({ status: 'paused' })
    renderWithI18n('stopwatch')
    expect(screen.queryByTestId('btn-start')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-resume')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
  })

  it('clicking Start calls stopwatchStore.start()', async () => {
    const user = userEvent.setup()
    const startSpy = vi.fn()
    useStopwatchStore.setState({ start: startSpy } as never)
    renderWithI18n('stopwatch')
    await user.click(screen.getByTestId('btn-start'))
    expect(startSpy).toHaveBeenCalledOnce()
  })

  it('stopwatch mode does NOT affect timerStore', async () => {
    const user = userEvent.setup()
    const timerStartSpy = vi.fn()
    useTimerStore.setState({ start: timerStartSpy } as never)
    useStopwatchStore.setState({ status: 'stopped' })
    renderWithI18n('stopwatch')
    await user.click(screen.getByTestId('btn-start'))
    expect(timerStartSpy).not.toHaveBeenCalled()
  })
})

describe('TimerControls — clock/both modes use timerStore', () => {
  it('clock mode running: shows Pause + Reset', () => {
    useTimerStore.setState({ status: 'running' })
    renderWithI18n('clock')
    expect(screen.getByTestId('btn-pause')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
  })

  it('both mode paused: shows Resume + Reset', () => {
    useTimerStore.setState({ status: 'paused' })
    renderWithI18n('both')
    expect(screen.getByTestId('btn-resume')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
  })
})

describe('TimerControls — projection integration', () => {
  beforeEach(() => {
    mockStartProjection.mockClear()
  })

  it('clicking Start starts the timer projection session', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({ status: 'stopped' })
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-start'))
    expect(mockStartProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([['timer:tick', expect.objectContaining({ mode: 'timer' })]])
    )
  })

  it('clicking Resume starts the timer projection session', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({ status: 'paused' })
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-resume'))
    expect(mockStartProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([['timer:tick', expect.objectContaining({ mode: 'timer' })]])
    )
  })

  it('clicking Pause does NOT start a projection session', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({ status: 'running' })
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-pause'))
    expect(mockStartProjection).not.toHaveBeenCalled()
  })

  it('clicking Reset does NOT start a projection session', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({ status: 'running' })
    renderWithI18n('timer')
    await user.click(screen.getByTestId('btn-reset'))
    expect(mockStartProjection).not.toHaveBeenCalled()
  })

  it('stopwatch Start also starts the timer projection session', async () => {
    const user = userEvent.setup()
    useStopwatchStore.setState({ status: 'stopped' })
    renderWithI18n('stopwatch')
    await user.click(screen.getByTestId('btn-start'))
    expect(mockStartProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([
        ['timer:tick', expect.objectContaining({ phase: expect.any(String) })]
      ])
    )
  })

  it('stopwatch Resume also starts the timer projection session', async () => {
    const user = userEvent.setup()
    useStopwatchStore.setState({ status: 'paused' })
    renderWithI18n('stopwatch')
    await user.click(screen.getByTestId('btn-resume'))
    expect(mockStartProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([
        ['timer:tick', expect.objectContaining({ phase: expect.any(String) })]
      ])
    )
  })
})

describe('TimerControls — aria-keyshortcuts', () => {
  it('play button has aria-keyshortcuts="Space"', () => {
    renderWithI18n('timer')
    const el = document.querySelector('[aria-keyshortcuts="Space"]')
    expect(el).not.toBeNull()
  })

  it('reset button has aria-keyshortcuts="R"', () => {
    renderWithI18n('timer')
    const el = document.querySelector('[aria-keyshortcuts="R"]')
    expect(el).not.toBeNull()
  })
})
