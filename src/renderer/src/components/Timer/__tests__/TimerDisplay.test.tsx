import { render, screen, fireEvent } from '@testing-library/react'
import TimerDisplay from '../TimerDisplay'

describe('TimerDisplay', () => {
  it('renders idle phase correctly', () => {
    render(<TimerDisplay phase="idle" mainDisplay="05:00" progress={1} />)
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders main phase with sub-display', () => {
    render(<TimerDisplay phase="main" mainDisplay="02:00" subDisplay="01:00" progress={0.5} />)
    expect(screen.getByText('02:00')).toBeInTheDocument()
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('renders main phase without sub-display', () => {
    render(<TimerDisplay phase="main" mainDisplay="02:00" progress={0.5} />)
    expect(screen.getByText('02:00')).toBeInTheDocument()
    expect(screen.queryByText('01:00')).not.toBeInTheDocument()
  })

  it('renders warning phase correctly', () => {
    render(<TimerDisplay phase="warning" mainDisplay="00:30" progress={0.2} />)
    const mainDisplay = screen.getByText('00:30')
    expect(mainDisplay).toBeInTheDocument()
    expect(mainDisplay).toHaveClass('text-danger')
  })

  it('renders overtime phase with overtime display', () => {
    render(
      <TimerDisplay phase="overtime" mainDisplay="00:00" overtimeDisplay="00:15" progress={0} />
    )
    expect(screen.getByText('00:15')).toBeInTheDocument()
  })

  it('renders overtime phase with overtime message', () => {
    render(
      <TimerDisplay
        phase="overtime"
        mainDisplay="00:00"
        overtimeMessage="Time Is Up!"
        progress={0}
      />
    )
    expect(screen.getByText('Time Is Up!')).toBeInTheDocument()
  })

  it('calls onTimeClick when clicked', () => {
    const handleClick = vi.fn()
    render(<TimerDisplay phase="idle" mainDisplay="05:00" progress={1} onTimeClick={handleClick} />)
    fireEvent.click(screen.getByText('05:00'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not crash when clicked without onTimeClick', () => {
    render(<TimerDisplay phase="idle" mainDisplay="05:00" progress={1} />)
    expect(() => fireEvent.click(screen.getByText('05:00'))).not.toThrow()
  })

  it('renders with custom size', () => {
    const { container } = render(
      <TimerDisplay phase="idle" mainDisplay="05:00" progress={1} size={400} />
    )
    expect(container.firstChild).toHaveStyle('width: 400px')
    expect(container.firstChild).toHaveStyle('height: 400px')
  })
})
