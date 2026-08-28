import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OneDriveIcon } from '../OneDriveIcon'
import { SyncProviderIcon } from '../SyncProviderIcon'

describe('SyncProviderIcon', () => {
  it('renders the existing OneDrive icon for OneDrive', () => {
    const expected = render(<OneDriveIcon className="provider-icon" />).container.innerHTML
    const actual = render(<SyncProviderIcon providerType="onedrive" className="provider-icon" />)
      .container.innerHTML

    expect(actual).toBe(expected)
  })

  it('renders the existing FolderSync glyph for local folders', () => {
    const { container } = render(<SyncProviderIcon providerType="local-fs" />)

    expect(container.querySelector('svg.lucide-folder-sync')).toBeInTheDocument()
  })

  it('uses the caller size without adding a LINE-only wrapper', () => {
    const { container } = render(<SyncProviderIcon providerType="hhc-line" className="size-4" />)

    const icon = screen.getByRole('img', { name: 'LINE' })
    expect(icon.tagName).toBe('svg')
    expect(icon).toHaveClass('size-4')
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    expect(icon).toHaveAttribute('fill', 'currentColor')
    expect(container.firstElementChild).toBe(icon)
  })
})
