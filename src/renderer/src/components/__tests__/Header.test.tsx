import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import { useTimerStore } from '@renderer/stores/timer'
import Header from '../Header'

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: vi.fn()
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
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Header />
      },
      {
        path: '/timer',
        element: <Header />
      }
    ],
    { initialEntries }
  )
  return render(<RouterProvider router={router} />)
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a header element', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/contexts/ProjectionContext')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: false,
      isProjectionBlanked: true,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('renders close projection button with correct aria-label in English', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/contexts/ProjectionContext')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: true,
      isProjectionBlanked: false,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    expect(screen.getByRole('button', { name: 'Close projection window' })).toBeInTheDocument()
  })

  it('disables close projection button when projection is not open', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/contexts/ProjectionContext')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: false,
      isProjectionBlanked: true,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    const button = screen.getByRole('button', { name: 'Close projection window' })
    expect(button).toBeDisabled()
  })

  it('enables close projection button when projection is open', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/contexts/ProjectionContext')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: true,
      isProjectionBlanked: false,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    const button = screen.getByRole('button', { name: 'Close projection window' })
    expect(button).not.toBeDisabled()
  })

  it('renders close projection button with correct aria-label in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    const { useProjection } = await import('@renderer/contexts/ProjectionContext')
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: true,
      isProjectionBlanked: false,
      openProjection: vi.fn(),
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    expect(screen.getByRole('button', { name: '關閉投影視窗' })).toBeInTheDocument()
    await i18n.changeLanguage('en')
  })

  describe('blank toggle button', () => {
    it('renders with "Blank projection" label when not blanked', async () => {
      await i18n.changeLanguage('en')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: true,
        isProjectionBlanked: false,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      expect(screen.getByRole('button', { name: 'Blank projection' })).toBeInTheDocument()
    })

    it('renders with "Show projection" label when blanked', async () => {
      await i18n.changeLanguage('en')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: true,
        isProjectionBlanked: true,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      expect(screen.getByRole('button', { name: 'Show projection' })).toBeInTheDocument()
    })

    it('is disabled when projection is not open', async () => {
      await i18n.changeLanguage('en')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: false,
        isProjectionBlanked: true,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      expect(screen.getByRole('button', { name: 'Show projection' })).toBeDisabled()
    })

    it('is enabled when projection is open', async () => {
      await i18n.changeLanguage('en')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: true,
        isProjectionBlanked: false,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      expect(screen.getByRole('button', { name: 'Blank projection' })).not.toBeDisabled()
    })

    it('calls blankProjection with toggled value on press', async () => {
      await i18n.changeLanguage('en')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      const blankProjection = vi.fn()
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: true,
        isProjectionBlanked: false,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection,
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Blank projection' }))
      expect(blankProjection).toHaveBeenCalledWith(true)
    })

    it('renders with correct aria-label in zh-TW', async () => {
      await i18n.changeLanguage('zh-TW')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: true,
        isProjectionBlanked: false,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      expect(screen.getByRole('button', { name: '關閉投影' })).toBeInTheDocument()
      await i18n.changeLanguage('en')
    })
  })

  describe('route-aware ModeSelector', () => {
    it('shows ModeSelector tabs on /timer route', async () => {
      await i18n.changeLanguage('en')
      useTimerStore.setState({ mode: 'timer' })
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: false,
        isProjectionBlanked: true,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/timer'])
      expect(screen.getByTestId('mode-timer')).toBeInTheDocument()
      expect(screen.getByTestId('mode-clock')).toBeInTheDocument()
      expect(screen.getByTestId('mode-both')).toBeInTheDocument()
      expect(screen.getByTestId('mode-stopwatch')).toBeInTheDocument()
    })

    it('does not show ModeSelector on non-timer routes', async () => {
      await i18n.changeLanguage('en')
      const { useProjection } = await import('@renderer/contexts/ProjectionContext')
      vi.mocked(useProjection).mockReturnValue({
        isProjectionOpen: false,
        isProjectionBlanked: true,
        openProjection: vi.fn(),
        closeProjection: vi.fn(),
        blankProjection: vi.fn(),
        project: vi.fn(),
        send: vi.fn(),
        on: vi.fn()
      })
      renderWithRouter(['/'])
      expect(screen.queryByTestId('mode-timer')).not.toBeInTheDocument()
    })
  })
})
