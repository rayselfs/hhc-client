import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PresentationHomeRibbon from '../PresentationHomeRibbon'
import { createDefaultPresentationTheme } from '@renderer/lib/editable-presentation'

const props = {
  disabled: false,
  fontFamilies: ['Inter Variable'],
  fontFamily: 'Inter Variable',
  fontSize: 24,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  baseline: 'normal' as const,
  color: '#111827',
  highlightColor: null,
  align: 'left' as const,
  theme: createDefaultPresentationTheme(),
  onFontFamilyChange: vi.fn(),
  onFontSizeChange: vi.fn(),
  onGrowFont: vi.fn(),
  onShrinkFont: vi.fn(),
  onCharacterStyle: vi.fn(),
  onChangeCase: vi.fn(),
  onReset: vi.fn(),
  onAlign: vi.fn(),
  onBullets: vi.fn(),
  onNumbering: vi.fn(),
  onDecreaseIndent: vi.fn(),
  onIncreaseIndent: vi.fn(),
  onLineSpacing: vi.fn(),
  onAutoWidth: vi.fn()
}

describe('PresentationHomeRibbon', () => {
  it('keeps the PowerPoint-like font and paragraph controls in one ribbon', () => {
    render(<PresentationHomeRibbon {...props} />)

    const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(labels).toEqual(
      expect.arrayContaining([
        'Increase font size',
        'Decrease font size',
        'Clear formatting',
        'Strikethrough',
        'Superscript',
        'Subscript',
        'Bullets',
        'Numbering',
        'Decrease indent',
        'Increase indent',
        'Align left',
        'Center',
        'Align right',
        'Justify',
        'Auto width'
      ])
    )
    expect(
      screen.queryByRole('button', { name: /reload|load local fonts/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /paste/i })).not.toBeInTheDocument()
  })
})
