import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PresentationColorPalette from '../PresentationColorPalette'
import { createDefaultPresentationTheme } from '@renderer/lib/editable-presentation'

describe('PresentationColorPalette', () => {
  it('offers theme and standard font colors without No Color', async () => {
    const onChange = vi.fn()
    render(
      <PresentationColorPalette
        kind="font"
        value="#111827"
        theme={createDefaultPresentationTheme()}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Font color menu' }))

    expect(await screen.findByText('Theme Colors')).toBeInTheDocument()
    expect(screen.getByText('Standard Colors')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No Color' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('More Colors…')).toBeInTheDocument()
  })

  it('puts No Color first in the highlight palette', async () => {
    const onChange = vi.fn()
    render(
      <PresentationColorPalette
        kind="highlight"
        value="#ffff00"
        theme={createDefaultPresentationTheme()}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text highlight color menu' }))
    fireEvent.click(await screen.findByRole('button', { name: 'No Color' }))

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByLabelText('More Colors…')).not.toBeInTheDocument()
  })
})
