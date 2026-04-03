import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { ThemeProvider } from '../contexts/ThemeContext'

function mockMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
  mockMatchMedia(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderApp(): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  )
}

describe('App dark mode toggle', () => {
  it('renders the theme toggle button', () => {
    renderApp()
    expect(screen.getByRole('button', { name: /system|light|dark/i })).toBeInTheDocument()
  })

  it('shows System label by default', () => {
    renderApp()
    expect(screen.getByRole('button', { name: '💻 System' })).toBeInTheDocument()
  })

  it('cycles system → light on first click', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: '💻 System' }))
    expect(screen.getByRole('button', { name: '☀️ Light' })).toBeInTheDocument()
  })

  it('cycles light → dark on second click', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: '💻 System' }))
    await user.click(screen.getByRole('button', { name: '☀️ Light' }))
    expect(screen.getByRole('button', { name: '🌙 Dark' })).toBeInTheDocument()
  })

  it('cycles dark → system on third click', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: '💻 System' }))
    await user.click(screen.getByRole('button', { name: '☀️ Light' }))
    await user.click(screen.getByRole('button', { name: '🌙 Dark' }))
    expect(screen.getByRole('button', { name: '💻 System' })).toBeInTheDocument()
  })

  it('adds .dark class to documentElement after toggling to dark', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: '💻 System' }))
    await user.click(screen.getByRole('button', { name: '☀️ Light' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes .dark class when toggling away from dark', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: '💻 System' }))
    await user.click(screen.getByRole('button', { name: '☀️ Light' }))
    await user.click(screen.getByRole('button', { name: '🌙 Dark' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
