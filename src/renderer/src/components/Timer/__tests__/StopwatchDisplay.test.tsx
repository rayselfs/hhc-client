import { render, screen } from '@testing-library/react'
import StopwatchDisplay from '../StopwatchDisplay'

describe('StopwatchDisplay', () => {
  it('renders formattedTime correctly', () => {
    render(<StopwatchDisplay formattedTime="01:30" />)
    expect(screen.getByText('01:30')).toBeInTheDocument()
  })

  it('renders zero state correctly', () => {
    render(<StopwatchDisplay formattedTime="00:00" />)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('has correct data-testid', () => {
    render(<StopwatchDisplay formattedTime="01:30" />)
    expect(screen.getByTestId('stopwatch-display')).toBeInTheDocument()
  })

  it('updates when formattedTime prop changes', () => {
    const { rerender } = render(<StopwatchDisplay formattedTime="00:00" />)
    expect(screen.getByText('00:00')).toBeInTheDocument()

    rerender(<StopwatchDisplay formattedTime="01:30" />)
    expect(screen.getByText('01:30')).toBeInTheDocument()
    expect(screen.queryByText('00:00')).not.toBeInTheDocument()
  })

  it('is purely presentational — no store interactions', () => {
    const { container } = render(<StopwatchDisplay formattedTime="05:00" />)
    expect(container.firstChild).toBeDefined()
    expect(screen.getByText('05:00')).toBeInTheDocument()
  })

  it('applies maxWidth when size is provided', () => {
    render(<StopwatchDisplay formattedTime="01:00" size={128} />)
    const el = screen.getByTestId('stopwatch-display')
    expect(el).toHaveStyle('max-width: 384px')
  })

  it('has no maxWidth when size is not provided', () => {
    render(<StopwatchDisplay formattedTime="01:00" />)
    const el = screen.getByTestId('stopwatch-display')
    expect(el.style.maxWidth).toBe('')
  })

  it('uses @container class for responsive sizing', () => {
    render(<StopwatchDisplay formattedTime="01:00" />)
    const el = screen.getByTestId('stopwatch-display')
    expect(el.className).toContain('@container')
  })
})
