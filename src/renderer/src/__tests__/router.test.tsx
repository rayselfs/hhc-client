import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import routes from '../router'

beforeEach(() => {
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

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(routes, { initialEntries })
  return render(<RouterProvider router={router} />)
}

describe('Router', () => {
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
    render(<RouterProvider router={router} />)

    expect(screen.getByTestId('timer-page')).toBeInTheDocument()

    const bibleLink = screen.getByRole('link', { name: /bible/i })
    await user.click(bibleLink)

    expect(screen.getByTestId('bible-page')).toBeInTheDocument()
    expect(screen.queryByTestId('timer-page')).not.toBeInTheDocument()
  })
})
