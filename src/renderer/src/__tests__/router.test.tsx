import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import routes from '../router'
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
