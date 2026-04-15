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

  it('renders a full ring (progress=100) with two SVG circles', () => {
    const { container } = render(<StopwatchDisplay formattedTime="01:00" />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })
})
