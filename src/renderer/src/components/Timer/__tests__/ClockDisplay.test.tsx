import { render, screen, act } from '@testing-library/react'
import ClockDisplay from '@renderer/components/Timer/ClockDisplay'

describe('ClockDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T14:30:45'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders current time in HH:MM:SS format', () => {
    render(<ClockDisplay />)
    expect(screen.getByText('14:30:45')).toBeInTheDocument()
  })

  it('updates after 1 second', () => {
    render(<ClockDisplay />)
    expect(screen.getByText('14:30:45')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('14:30:46')).toBeInTheDocument()
  })

  it('cleans up interval on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<ClockDisplay />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })

  it('renders with data-testid', () => {
    render(<ClockDisplay />)
    expect(screen.getByTestId('clock-display')).toBeInTheDocument()
  })
})
