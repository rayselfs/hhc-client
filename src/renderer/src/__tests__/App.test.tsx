import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import routes from '@renderer/router'
import { ThemeProvider, useTheme } from '@renderer/contexts/ThemeContext'

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: vi.fn().mockReturnValue({
      isProjectionOpen: false,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
  }
})

function renderApp(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const testRouter = createMemoryRouter(routes, { initialEntries })
  return render(
    <ThemeProvider>
      <RouterProvider router={testRouter} />
    </ThemeProvider>
  )
}

function DarkModeToggle(): React.JSX.Element {
  const { setPreference } = useTheme()
  return <button onClick={() => setPreference('dark')}>Set Dark</button>
}

function renderAppWithToggle(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const testRouter = createMemoryRouter(routes, { initialEntries })
  return render(
    <ThemeProvider>
      <DarkModeToggle />
      <RouterProvider router={testRouter} />
    </ThemeProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App integration', () => {
  it('renders sidebar layout with timer and bible items', () => {
    renderApp(['/'])
    expect(screen.getByRole('link', { name: /timer/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /bible/i })).toBeInTheDocument()
  })

  it('shows timer page by default', () => {
    renderApp(['/'])
    expect(screen.getByTestId('timer-page')).toBeInTheDocument()
  })

  it('shows bible page at /bible', () => {
    renderApp(['/bible'])
    expect(screen.getByTestId('bible-page')).toBeInTheDocument()
  })

  it('dark mode toggle works', async () => {
    const user = userEvent.setup()
    renderAppWithToggle(['/'])
    await user.click(screen.getByText('Set Dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
