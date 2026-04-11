import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import { useTimerStore } from '@renderer/stores/timer'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import ConfirmDialog from '../ConfirmDialog'
import Header from '../Header'

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: vi.fn()
  }
})

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <ConfirmDialogProvider>
            <Header />
            <ConfirmDialog />
          </ConfirmDialogProvider>
        )
      },
      {
        path: '/timer',
        element: (
          <ConfirmDialogProvider>
            <Header />
            <ConfirmDialog />
          </ConfirmDialogProvider>
        )
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

  it('renders close projection button with correct aria-label in English when open', async () => {
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

  it('renders open projection button when projection is not open', async () => {
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
    expect(screen.getByRole('button', { name: 'Open projection window' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open projection window' })).not.toBeDisabled()
  })

  it('calls openProjection when projection is closed and open-btn pressed', async () => {
    await i18n.changeLanguage('en')
    const { useProjection } = await import('@renderer/contexts/ProjectionContext')
    const openProjection = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useProjection).mockReturnValue({
      isProjectionOpen: false,
      isProjectionBlanked: true,
      openProjection,
      closeProjection: vi.fn(),
      blankProjection: vi.fn(),
      project: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    })
    renderWithRouter(['/'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open projection window' }))
    expect(openProjection).toHaveBeenCalled()
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
