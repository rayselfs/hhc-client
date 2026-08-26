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

  it('renders the official unstyled LINE image at a minimum of 20px', () => {
    render(
      <SyncProviderIcon
        providerType="hhc-line"
        className="size-6 text-danger bg-danger shadow-lg mask animate-spin decoration-solid"
      />
    )

    const image = screen.getByRole('img', { name: 'LINE' })
    expect(Number(image.getAttribute('width'))).toBeGreaterThanOrEqual(20)
    expect(Number(image.getAttribute('height'))).toBeGreaterThanOrEqual(20)
    expect(image).toHaveAttribute('src', expect.stringContaining('line-brand-icon'))
    expect(image.className).not.toMatch(
      /(?:^|\s)(?:text-|bg-|shadow|drop-shadow|mask|animate-|decoration-)/
    )
  })
})
