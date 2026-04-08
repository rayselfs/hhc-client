import { render, screen } from '@testing-library/react'
import TimerRing from '../TimerRing'

describe('TimerRing', () => {
  it('renders SVG with two circles', () => {
    const { container } = render(<TimerRing progress={50} size={200} />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('renders children content', () => {
    render(
      <TimerRing progress={50} size={200}>
        <span>05:00</span>
      </TimerRing>
    )
    expect(screen.getByText('05:00')).toBeInTheDocument()
  })

  it('applies correct size', () => {
    const { container } = render(<TimerRing progress={50} size={300} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle('width: 300px')
    expect(wrapper).toHaveStyle('height: 300px')
  })

  it('applies accent color by default', () => {
    const { container } = render(<TimerRing progress={50} size={200} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1]).toHaveClass('stroke-accent')
  })

  it('applies danger color when specified', () => {
    const { container } = render(<TimerRing progress={50} size={200} color="danger" />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1]).toHaveClass('stroke-danger')
  })

  it('calculates stroke-dashoffset based on progress', () => {
    const size = 200
    const strokeWidth = Math.max(Math.round(size * 0.02), 2)
    const radius = size / 2 - strokeWidth - 2
    const circumference = 2 * Math.PI * radius
    const expectedOffset = (75 / 100) * circumference

    const { container } = render(<TimerRing progress={75} size={size} />)
    const fgCircle = container.querySelectorAll('circle')[1]
    expect(fgCircle.getAttribute('stroke-dashoffset')).toBe(String(expectedOffset))
  })

  it('renders with zero progress', () => {
    const { container } = render(<TimerRing progress={0} size={200} />)
    const fgCircle = container.querySelectorAll('circle')[1]
    expect(fgCircle.getAttribute('stroke-dashoffset')).toBe('0')
  })

  it('renders with full progress', () => {
    const size = 200
    const strokeWidth = Math.max(Math.round(size * 0.02), 2)
    const radius = size / 2 - strokeWidth - 2
    const circumference = 2 * Math.PI * radius

    const { container } = render(<TimerRing progress={100} size={size} />)
    const fgCircle = container.querySelectorAll('circle')[1]
    expect(fgCircle.getAttribute('stroke-dashoffset')).toBe(String(circumference))
  })

  it('applies custom className', () => {
    const { container } = render(<TimerRing progress={50} size={200} className="my-custom" />)
    expect(container.firstChild).toHaveClass('my-custom')
  })
})
