import { render, screen } from '@testing-library/react'
import TimerDisplay from '../TimerDisplay'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('TimerDisplay', () => {
  it('renders idle phase correctly', () => {
    const { container } = render(<TimerDisplay phase="idle" mainDisplay="05:00" progress={1} />)
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(2)
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

  it('renders overtime phase with fallback 00:00 when no overtimeDisplay', () => {
    render(<TimerDisplay phase="overtime" mainDisplay="00:00" progress={0} />)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('renders digit as clickable when canEditTime is true', () => {
    render(
      <TimerDisplay
        phase="idle"
        mainDisplay="05:00"
        progress={1}
        canEditTime
        onTimeConfirm={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /set timer duration/i })).toBeInTheDocument()
  })

  it('does not render digit as clickable when canEditTime is false', () => {
    render(<TimerDisplay phase="idle" mainDisplay="05:00" progress={1} />)
    expect(screen.queryByRole('button', { name: /set timer duration/i })).not.toBeInTheDocument()
  })

  it('renders with custom size', () => {
    const { container } = render(
      <TimerDisplay phase="idle" mainDisplay="05:00" progress={1} size={400} />
    )
    expect(container.firstChild).toHaveStyle('max-width: 400px')
    expect(container.firstChild).toHaveStyle('aspect-ratio: 1')
  })
})
