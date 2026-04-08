import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import routes from '@renderer/router'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'

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

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react')

  let capturedOnSelectionChange: ((key: string) => void) | undefined
  let capturedSelectedKey: string | undefined

  const TabsMock = Object.assign(
    ({
      children,
      selectedKey,
      onSelectionChange
    }: {
      children: React.ReactNode
      selectedKey?: string
      onSelectionChange?: (key: string) => void
    }) => {
      capturedOnSelectionChange = onSelectionChange
      capturedSelectedKey = selectedKey
      return <div role="tablist">{children}</div>
    },
    {
      List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Tab: ({
        children,
        id,
        'data-testid': dataTestId,
        ...rest
      }: {
        children: React.ReactNode
        id?: string
        'data-testid'?: string
        [key: string]: unknown
      }) => (
        <button
          role="tab"
          aria-selected={capturedSelectedKey === id}
          data-testid={dataTestId}
          onClick={() => id && capturedOnSelectionChange?.(id)}
          {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {children}
        </button>
      ),
      Indicator: () => null
    }
  )

  return {
    ...actual,
    Tabs: TabsMock,
    Modal: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
      Root: ({ state, children }: { state?: { isOpen: boolean }; children: React.ReactNode }) =>
        state?.isOpen ? <div>{children}</div> : null,
      Trigger: () => null,
      Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Heading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Icon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CloseTrigger: () => null
    }),
    useOverlayState: (args?: { isOpen?: boolean; onOpenChange?: (open: boolean) => void }) => ({
      isOpen: args?.isOpen ?? false,
      setOpen: (v: boolean) => args?.onOpenChange?.(v),
      open: () => args?.onOpenChange?.(true),
      close: () => args?.onOpenChange?.(false),
      toggle: () => args?.onOpenChange?.(!args?.isOpen)
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
