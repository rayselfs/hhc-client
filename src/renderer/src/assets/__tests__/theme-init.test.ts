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

function runThemeInitLogic(): void {
  const pref = localStorage.getItem('hhc-theme')
  const isDark =
    pref === 'dark' ||
    (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
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

describe('theme-init FOUC prevention logic', () => {
  it('pref=dark → adds .dark class', () => {
    localStorage.setItem('hhc-theme', 'dark')
    mockMatchMedia(false)
    runThemeInitLogic()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('pref=light → no .dark class', () => {
    localStorage.setItem('hhc-theme', 'light')
    mockMatchMedia(true)
    runThemeInitLogic()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('pref=system + OS dark → adds .dark class', () => {
    localStorage.setItem('hhc-theme', 'system')
    mockMatchMedia(true)
    runThemeInitLogic()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('pref=system + OS light → no .dark class', () => {
    localStorage.setItem('hhc-theme', 'system')
    mockMatchMedia(false)
    runThemeInitLogic()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('pref=null (first visit) + OS dark → adds .dark class', () => {
    mockMatchMedia(true)
    runThemeInitLogic()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('pref=null (first visit) + OS light → no .dark class', () => {
    mockMatchMedia(false)
    runThemeInitLogic()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('sets colorScheme to dark when isDark', () => {
    localStorage.setItem('hhc-theme', 'dark')
    runThemeInitLogic()
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('sets colorScheme to light when not isDark', () => {
    localStorage.setItem('hhc-theme', 'light')
    runThemeInitLogic()
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('sets colorScheme to dark when system + OS dark', () => {
    mockMatchMedia(true)
    runThemeInitLogic()
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('sets colorScheme to light when system + OS light', () => {
    mockMatchMedia(false)
    runThemeInitLogic()
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
