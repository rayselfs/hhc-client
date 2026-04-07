import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import Header from '../Header'

vi.mock('@renderer/hooks/useProjection')

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Header />
      }
    ],
    { initialEntries }
  )
  return render(<RouterProvider router={router} />)
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a header element', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/hooks/useProjection')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: false,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('renders close projection button with correct aria-label in English', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/hooks/useProjection')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: true,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    expect(screen.getByRole('button', { name: 'Close projection window' })).toBeInTheDocument()
  })

  it('disables close projection button when projection is not open', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/hooks/useProjection')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: false,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    const button = screen.getByRole('button', { name: 'Close projection window' })
    expect(button).toBeDisabled()
  })

  it('enables close projection button when projection is open', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/hooks/useProjection')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: true,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    const button = screen.getByRole('button', { name: 'Close projection window' })
    expect(button).not.toBeDisabled()
  })

  it('renders close projection button with correct aria-label in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    const { useProjection } = await import('@renderer/hooks/useProjection')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: true,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    expect(screen.getByRole('button', { name: '關閉投影視窗' })).toBeInTheDocument()
    await i18n.changeLanguage('en')
  })
})
