import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '../ThemeContext'

function mockMatchMedia(prefersDark: boolean): Array<(e: MediaQueryListEvent) => void> {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        listeners.push(handler)
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
  return listeners
}

function TestConsumer(): React.JSX.Element {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setPreference('dark')}>Set Dark</button>
      <button onClick={() => setPreference('light')}>Set Light</button>
      <button onClick={() => setPreference('system')}>Set System</button>
    </div>
  )
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

describe('useTheme', () => {
  it('throws when used outside ThemeProvider', () => {
    // Suppress console.error for this expected throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<TestConsumer />)).toThrow('must be used within a ThemeProvider')
    consoleSpy.mockRestore()
  })
})

describe('ThemeProvider', () => {
  it('default preference is system', () => {
    mockMatchMedia(false)
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('preference').textContent).toBe('system')
  })

  it('resolved theme from system when OS prefers dark', () => {
    mockMatchMedia(true)
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('resolved theme from system when OS prefers light', () => {
    mockMatchMedia(false)
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('resolved theme from explicit dark regardless of matchMedia', () => {
    mockMatchMedia(false)
    localStorage.setItem('hhc-theme', 'dark')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('resolved theme from explicit light regardless of matchMedia', () => {
    mockMatchMedia(true)
    localStorage.setItem('hhc-theme', 'light')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('reads preference from localStorage on mount', () => {
    localStorage.setItem('hhc-theme', 'dark')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('preference').textContent).toBe('dark')
  })

  it('ignores invalid localStorage value and falls back to system', () => {
    localStorage.setItem('hhc-theme', 'garbage')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('preference').textContent).toBe('system')
  })

  it('persists preference to localStorage on change', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    await user.click(screen.getByText('Set Dark'))
    expect(localStorage.getItem('hhc-theme')).toBe('dark')
  })

  it('toggles .dark class on documentElement when resolved is dark', async () => {
    const user = userEvent.setup()
    mockMatchMedia(false)
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    await user.click(screen.getByText('Set Dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes .dark class on documentElement when resolved is light', async () => {
    const user = userEvent.setup()
    localStorage.setItem('hhc-theme', 'dark')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    await user.click(screen.getByText('Set Light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('sets colorScheme style to dark when resolved is dark', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    await user.click(screen.getByText('Set Dark'))
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('sets colorScheme style to light when resolved is light', async () => {
    const user = userEvent.setup()
    localStorage.setItem('hhc-theme', 'dark')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    await user.click(screen.getByText('Set Light'))
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('setPreference updates both preference and resolved', async () => {
    const user = userEvent.setup()
    mockMatchMedia(false)
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    // Initial state
    expect(screen.getByTestId('preference').textContent).toBe('system')
    expect(screen.getByTestId('resolved').textContent).toBe('light')

    await user.click(screen.getByText('Set Dark'))

    expect(screen.getByTestId('preference').textContent).toBe('dark')
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('uses renderHook to verify useTheme returns context values', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider
    })
    expect(result.current.preference).toBe('system')
    expect(result.current.resolved).toBe('light')
    expect(typeof result.current.setPreference).toBe('function')
  })

  it('setPreference via renderHook updates resolved', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider
    })
    act(() => {
      result.current.setPreference('dark')
    })
    expect(result.current.preference).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })
})
