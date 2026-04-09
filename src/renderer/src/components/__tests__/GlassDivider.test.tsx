import { render } from '@testing-library/react'
import GlassDivider from '@renderer/components/GlassDivider'

describe('GlassDivider', () => {
  it('renders a horizontal divider by default', () => {
    const { container } = render(<GlassDivider />)
    const hr = container.querySelector('hr')
    expect(hr).toBeInTheDocument()
    expect(hr!.style.width).toBe('100%')
    expect(hr!.style.background).toContain('90deg')
  })

  it('renders a vertical divider when vertical=true', () => {
    const { container } = render(<GlassDivider vertical />)
    const hr = container.querySelector('hr')
    expect(hr).toBeInTheDocument()
    expect(hr!.style.minHeight).toBe('100%')
    expect(hr!.style.background).toContain('180deg')
  })

  it('applies custom thickness', () => {
    const { container } = render(<GlassDivider thickness={2} />)
    const hr = container.querySelector('hr')
    expect(hr!.style.height).toBe('2px')
  })

  it('applies custom className', () => {
    const { container } = render(<GlassDivider className="mx-4" />)
    const hr = container.querySelector('hr')
    expect(hr!.className).toContain('mx-4')
  })
})
