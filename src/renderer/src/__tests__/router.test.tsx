import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import routes from '../router'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { ONBOARDED_KEY } from '@renderer/lib/onboarding'

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

describe('Router', () => {
  beforeEach(() => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('renders timer page at default route /', () => {
    renderWithRouter(['/'])
    expect(screen.getByTestId('timer-page')).toBeInTheDocument()
  })

  it('renders timer page at /timer route', () => {
    renderWithRouter(['/timer'])
    expect(screen.getByTestId('timer-page')).toBeInTheDocument()
  })

  it('renders bible page at /bible route', () => {
    renderWithRouter(['/bible'])
    expect(screen.getByTestId('bible-page')).toBeInTheDocument()
  })

  it('navigates from timer to bible via sidebar link', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    )

    expect(screen.getByTestId('timer-page')).toBeInTheDocument()

    const bibleLink = screen.getByRole('link', { name: /bible/i })
    await user.click(bibleLink)

    expect(screen.getByTestId('bible-page')).toBeInTheDocument()
    expect(screen.queryByTestId('timer-page')).not.toBeInTheDocument()
  })
})
