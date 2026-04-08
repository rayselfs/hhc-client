import { render, screen } from '@testing-library/react'
import ProgressRing from '../ProgressRing'

describe('ProgressRing', () => {
  it('renders a progressbar role element', () => {
    render(<ProgressRing value={50} size={200} aria-label="Test progress" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('sets aria-valuenow to rounded value', () => {
    render(<ProgressRing value={73.6} size={200} aria-label="Test progress" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '74')
  })

  it('sets aria-valuemin to 0 and aria-valuemax to 100', () => {
    render(<ProgressRing value={50} size={200} />)
    const el = screen.getByRole('progressbar')
    expect(el).toHaveAttribute('aria-valuemin', '0')
    expect(el).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps value above 100 to 100', () => {
    render(<ProgressRing value={150} size={200} aria-label="Test progress" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('clamps value below 0 to 0', () => {
    render(<ProgressRing value={-10} size={200} aria-label="Test progress" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders children inside the ring', () => {
    render(
      <ProgressRing value={50} size={200}>
        <span>inner</span>
      </ProgressRing>
    )
    expect(screen.getByText('inner')).toBeInTheDocument()
  })

  it('applies the given size as width and height', () => {
    render(<ProgressRing value={50} size={300} aria-label="Test progress" />)
    const el = screen.getByRole('progressbar')
    expect(el).toHaveStyle('width: 300px')
    expect(el).toHaveStyle('height: 300px')
  })

  it('renders SVG with linearGradient for primary color by default', () => {
    const { container } = render(<ProgressRing value={50} size={200} />)
    const gradients = container.querySelectorAll('linearGradient')
    expect(gradients.length).toBeGreaterThan(0)
  })

  it('renders without crashing for all supported colors', () => {
    const colors = ['primary', 'secondary', 'error', 'warning', 'success', 'info'] as const
    colors.forEach((color) => {
      expect(() =>
        render(<ProgressRing value={50} size={200} color={color} aria-label="Test progress" />)
      ).not.toThrow()
    })
  })

  it('renders SVG circles for background and progress tracks', () => {
    const { container } = render(<ProgressRing value={75} size={200} aria-label="progress" />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })

  it('passes aria-label to progressbar', () => {
    render(<ProgressRing value={50} size={200} aria-label="Timer ring" />)
    expect(screen.getByRole('progressbar', { name: 'Timer ring' })).toBeInTheDocument()
  })
})
