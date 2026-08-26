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

  it('protects the official LINE image with its required clear space', () => {
    render(<SyncProviderIcon providerType="hhc-line" />)

    const image = screen.getByRole('img', { name: 'LINE' })
    const imageWidth = Number(image.getAttribute('width'))
    const imageHeight = Number(image.getAttribute('height'))
    const wrapper = image.parentElement
    expect(wrapper).not.toBeNull()
    expect(imageWidth).toBeGreaterThanOrEqual(20)
    expect(imageHeight).toBeGreaterThanOrEqual(20)
    expect(image).toHaveAttribute('src', expect.stringContaining('line-brand-icon'))
    expect(Number.parseFloat(wrapper?.style.padding ?? '')).toBeGreaterThanOrEqual(imageWidth / 2)
  })

  it('rejects caller visual effects across the LINE icon subtree', () => {
    const { container } = render(
      <SyncProviderIcon
        providerType="hhc-line"
        className="size-6 text-danger bg-danger shadow-lg mask animate-spin decoration-solid"
      />
    )

    for (const element of container.querySelectorAll('*')) {
      expect(element?.getAttribute('class') ?? '').not.toMatch(
        /(?:^|\s)(?:text-|bg-|shadow|drop-shadow|mask|animate-|decoration-)/
      )
    }
  })
})
