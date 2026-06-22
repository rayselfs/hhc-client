import { render, screen, act, waitFor } from '@testing-library/react'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'
import { useSettingsStore } from '@renderer/stores/settings'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn(() => false),
  isWeb: vi.fn(() => true)
}))

vi.mock('@renderer/components/Projection/DefaultProjection', () => ({
  default: () => <div data-testid="default-projection">Default</div>
}))

vi.mock('@renderer/components/Projection/FileProjection', () => ({
  default: ({ controlEvent }: { controlEvent?: { data: { action: string } } | null }) => (
    <div data-testid="file-projection" data-control-action={controlEvent?.data.action ?? ''} />
  )
}))

vi.mock('@renderer/components/Projection/SlideProjection', () => ({
  default: ({ slideIndex }: { slideIndex: number }) => (
    <div data-testid="slide-projection" data-slide-index={slideIndex} />
  )
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

const mockProjectionVlcStop = vi.fn()

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
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      projectionVlc: {
        stop: mockProjectionVlcStop
      }
    }
  })
})

describe('ProjectionPage', () => {
  it('renders default content when no timer data received', () => {
    render(<ProjectionPage />)
    expect(screen.getByTestId('default-projection')).toBeInTheDocument()
  })

  it('announces projection route readiness', () => {
    render(<ProjectionPage />)

    expect(mockAdapter.send).toHaveBeenCalledWith('__system:ready', null)
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

  it('updates settings store timezone on settings:timezone message', () => {
    useSettingsStore.setState({ timezone: 'Asia/Taipei' })
    render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('settings:timezone', { timezone: 'America/New_York' })
    })
    expect(useSettingsStore.getState().timezone).toBe('America/New_York')
  })

  it('updates timer ring color on settings:timer-ring-color message', () => {
    const { container } = render(<ProjectionPage />)
    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('timer:tick', { ...baseTimerTick, mode: 'timer' })
      mockAdapter._trigger('settings:timer-ring-color', { color: '#ef4444' })
    })
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('keeps an early file control command until file projection mounts', () => {
    render(<ProjectionPage />)

    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('file:control', { action: 'play', itemId: 'video-1' })
      mockAdapter._trigger('file:show', {
        itemId: 'video-1',
        blobId: 'blob-1',
        fileName: 'video.mkv',
        mimeType: 'video/mp4',
        playlist: [],
        currentIndex: 0,
        streamUrl: 'hhc-media://native/source-id',
        seekable: false
      })
    })

    expect(screen.getByTestId('file-projection')).toHaveAttribute('data-control-action', 'play')
  })

  it('shows slide projection when receiving slide:show', () => {
    render(<ProjectionPage />)

    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('slide:show', {
        document: {
          id: 'deck-1',
          version: 1,
          title: 'Deck',
          size: { width: 1920, height: 1080 },
          theme: {
            id: 'default-dark',
            name: 'Default Dark',
            fontFamily: 'Inter Variable',
            textColor: '#ffffff',
            backgroundColor: '#050505',
            accentColor: '#0ea5e9'
          },
          slides: [],
          createdAt: 0,
          updatedAt: 0
        },
        slideIndex: 2
      })
    })

    expect(screen.getByTestId('slide-projection')).toHaveAttribute('data-slide-index', '2')
  })

  it('stops VLC when blanking file projection back to default', async () => {
    render(<ProjectionPage />)
    mockProjectionVlcStop.mockClear()

    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: false })
      mockAdapter._trigger('file:show', {
        itemId: 'video-1',
        blobId: 'blob-1',
        fileName: 'video.mkv',
        mimeType: 'video/x-matroska',
        playbackMode: 'vlc-embedded'
      })
    })
    expect(screen.getByTestId('file-projection')).toBeInTheDocument()

    act(() => {
      mockAdapter._trigger('__system:blank', { showDefault: true })
    })

    await waitFor(() => {
      expect(mockProjectionVlcStop).toHaveBeenCalled()
    })
  })
})
