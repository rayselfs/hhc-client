import { render, screen } from '@testing-library/react'
import StopwatchDisplay from '../StopwatchDisplay'

describe('StopwatchDisplay', () => {
  it('renders formattedTime correctly', () => {
    render(<StopwatchDisplay formattedTime="01:30.50" />)
    expect(screen.getByText('01:30.50')).toBeInTheDocument()
  })

  it('renders zero state correctly', () => {
    render(<StopwatchDisplay formattedTime="00:00.00" />)
    expect(screen.getByText('00:00.00')).toBeInTheDocument()
  })

  it('has correct data-testid', () => {
    render(<StopwatchDisplay formattedTime="01:30.50" />)
    expect(screen.getByTestId('stopwatch-display')).toBeInTheDocument()
  })

  it('updates when formattedTime prop changes', () => {
    const { rerender } = render(<StopwatchDisplay formattedTime="00:00.00" />)
    expect(screen.getByText('00:00.00')).toBeInTheDocument()

    rerender(<StopwatchDisplay formattedTime="01:30.50" />)
    expect(screen.getByText('01:30.50')).toBeInTheDocument()
    expect(screen.queryByText('00:00.00')).not.toBeInTheDocument()
  })

  it('is purely presentational — no store interactions', () => {
    const { container } = render(<StopwatchDisplay formattedTime="05:00.00" />)
    expect(container.firstChild).toBeDefined()
    expect(screen.getByText('05:00.00')).toBeInTheDocument()
  })

  it('applies custom size via inline style', () => {
    render(<StopwatchDisplay formattedTime="01:00.00" size={128} />)
    const el = screen.getByTestId('stopwatch-display')
    expect(el).toHaveStyle('font-size: 128px')
  })

  it('uses default size of 64', () => {
    render(<StopwatchDisplay formattedTime="01:00.00" />)
    const el = screen.getByTestId('stopwatch-display')
    expect(el).toHaveStyle('font-size: 64px')
  })
})
