import { render, screen, act } from '@testing-library/react'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn(() => false),
  isWeb: vi.fn(() => true)
}))

vi.mock('@renderer/components/projection/DefaultProjection', () => ({
  default: () => <div data-testid="default-projection">Default</div>
}))

const mockAdapter = (() => {
  const handlers = new Map<string, (data: unknown) => void>()
  return {
    send: vi.fn(),
    on: vi.fn((channel: string, handler: (data: unknown) => void) => {
      handlers.set(channel, handler)
      return () => {
        handlers.delete(channel)
      }
    }),
    dispose: vi.fn(),
    _trigger(channel: string, data: unknown) {
      handlers.get(channel)?.(data)
    }
  }
})()

vi.mock('@renderer/lib/projection-adapter', () => ({
  createProjectionAdapter: vi.fn(() => mockAdapter)
}))

import ProjectionPage from '../ProjectionPage'

const baseTimerTick: TimerTickPayload = {
  mode: 'timer',
  remainingSeconds: 120,
  phase: 'main',
  mainDisplay: '02:00',
  subDisplay: null,
  progress: 0.5,
  overtimeSeconds: 0,
  overtimeMessage: null,
  reminderColor: null
}

const baseStopwatchTick: StopwatchTickPayload = {
  elapsedMs: 5000,
  formattedTime: '00:05.00',
  status: 'running'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProjectionPage', () => {
  it('renders default content when no timer data received', () => {
    render(<ProjectionPage />)
    expect(screen.getByTestId('default-projection')).toBeInTheDocument()
  })

  it('shows TimerDisplay when receiving timer:tick with mode=timer', () => {
    const { container } = render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('timer:tick', { ...baseTimerTick, mode: 'timer' })
    })
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(screen.getByText('02:00')).toBeInTheDocument()
  })

  it('shows ClockDisplay when receiving timer:tick with mode=clock', () => {
    render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('timer:tick', { ...baseTimerTick, mode: 'clock' })
    })
    expect(screen.getByTestId('clock-display')).toBeInTheDocument()
  })

  it('shows StopwatchDisplay when receiving timer:tick with mode=stopwatch', () => {
    render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('timer:tick', { ...baseTimerTick, mode: 'stopwatch' })
      mockAdapter._trigger('timer:stopwatch', baseStopwatchTick)
    })
    expect(screen.getByTestId('stopwatch-display')).toBeInTheDocument()
    expect(screen.getByText('00:05.00')).toBeInTheDocument()
  })

  it('shows both TimerDisplay and ClockDisplay in both mode', () => {
    const { container } = render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('timer:tick', { ...baseTimerTick, mode: 'both' })
    })
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(screen.getByTestId('clock-display')).toBeInTheDocument()
  })

  it('blank layer hides timer content: __system:blank with showDefault=true shows default', () => {
    render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('timer:tick', { ...baseTimerTick, mode: 'timer' })
      mockAdapter._trigger('__system:blank', { showDefault: true })
    })
    expect(screen.getByTestId('default-projection')).toBeInTheDocument()
    expect(screen.queryByText('02:00')).not.toBeInTheDocument()
  })

  it('shows overtime message when phase is overtime', () => {
    render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('timer:tick', {
        ...baseTimerTick,
        mode: 'timer',
        phase: 'overtime',
        overtimeMessage: 'Please wrap up!'
      })
    })
    expect(screen.getByText('Please wrap up!')).toBeInTheDocument()
  })

  it('calls adapter.dispose on unmount', () => {
    const { unmount } = render(<ProjectionPage />)
    unmount()
    expect(mockAdapter.dispose).toHaveBeenCalled()
  })
})
