import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import routes from '@renderer/router'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: vi.fn().mockReturnValue({
      isProjectionOpen: false,
      isProjectionBlanked: true,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
  }
})

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(routes, { initialEntries })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

describe('Layout', () => {
  it('renders a header element', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('renders a main element', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(document.querySelector('main')).toBeInTheDocument()
  })

  it('renders timer-page content at route /', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByTestId('timer-page')).toBeInTheDocument()
  })

  it('renders bible-page content at route /bible', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/bible'])
    expect(screen.getByTestId('bible-page')).toBeInTheDocument()
  })

  it('renders sidebar timer and bible labels', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByRole('link', { name: /timer/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /bible/i })).toBeInTheDocument()
  })

  it('does not have a divider between header and main (no border-b on header)', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    const header = document.querySelector('header')
    expect(header).not.toBeNull()
    expect(header!.classList.contains('border-b')).toBe(false)
  })

  it('does not render an hr element between header and main', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(document.querySelector('hr')).not.toBeInTheDocument()
  })
})
