import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import routes from '@renderer/router'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { ONBOARDED_KEY } from '@renderer/lib/onboarding'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useBibleFolderStore } from '@renderer/stores/folder'

vi.mock('@renderer/lib/app-init', () => ({
  initializeApp: vi.fn(() => vi.fn()),
  prefetchRouteChunks: vi.fn(() => Promise.resolve())
}))

vi.mock('@renderer/pages/BiblePage', () => ({
  default: () => <div data-testid="bible-page" />
}))

vi.mock('@renderer/lib/timer-adapter', () => ({
  createTimerAdapter: vi.fn(() => ({
    onTick: vi.fn(),
    onFinished: vi.fn(),
    onStopwatchTick: vi.fn(),
    sendCommand: vi.fn(),
    dispose: vi.fn()
  }))
}))

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: vi.fn().mockReturnValue({
      isProjectionOpen: false,
      isProjectionBlanked: true,
      recovery: { status: 'closed', generation: 0, failure: null },
      openProjection: vi.fn(),
      retryProjection: vi.fn(),
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
  beforeEach(() => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    useFileExplorerStore.setState({ isInitialized: true, isLoading: false })
    useBibleFolderStore.setState({ isInitialized: true, isLoading: false })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('renders a header element', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    await screen.findByTestId('timer-page')
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('renders a main element', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    await screen.findByTestId('timer-page')
    expect(document.querySelector('main')).toBeInTheDocument()
  })

  it('renders timer-page content at route /', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(await screen.findByTestId('timer-page')).toBeInTheDocument()
  })

  it('renders bible-page content at route /bible', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/bible'])
    expect(await screen.findByTestId('bible-page')).toBeInTheDocument()
  })

  it('renders sidebar timer and bible labels', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    await screen.findByTestId('timer-page')
    expect(screen.getByRole('link', { name: /timer/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /bible/i })).toBeInTheDocument()
  })

  it('does not have a divider between header and main (no border-b on header)', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    await screen.findByTestId('timer-page')
    const header = document.querySelector('header')
    expect(header).not.toBeNull()
    expect(header!.classList.contains('border-b')).toBe(false)
  })

  it('does not render an hr element between header and main', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    await screen.findByTestId('timer-page')
    expect(document.querySelector('hr')).not.toBeInTheDocument()
  })
})
