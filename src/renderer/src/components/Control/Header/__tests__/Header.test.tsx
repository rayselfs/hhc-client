import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import { useTimerStore } from '@renderer/stores/timer'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useBibleProjectionStore } from '@renderer/stores/bible-projection'
import type { FileItemRecord } from '@shared/types/folder'
import type { ContentMessageTuple } from '@renderer/contexts/ProjectionContext'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import type { useProjection as useProjectionHook } from '@renderer/contexts/ProjectionContext'
import ConfirmDialog from '../../../Common/ConfirmDialog'
import Header from '../Header'

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: vi.fn()
  }
})

type MockProjectionContext = ReturnType<typeof useProjectionHook>

function makeFile(id: string): FileItemRecord {
  return {
    id,
    name: `${id}.png`,
    mimeType: 'image/png',
    type: 'file',
    sortIndex: 0,
    parentId: 'file-root',
    size: 1,
    url: `blob:${id}`,
    createdAt: Date.now(),
    expiresAt: null
  }
}

async function mockProjectionContext(
  overrides: Partial<MockProjectionContext> = {}
): Promise<MockProjectionContext> {
  const { useProjection } = await import('@renderer/contexts/ProjectionContext')
  const context = { ...baseProjectionContext(), ...overrides }
  vi.mocked(useProjection).mockReturnValue(context)
  return context
}

function baseProjectionContext(): MockProjectionContext {
  return {
    isProjectionOpen: false,
    isProjectionBlanked: true,
    projectionReadyCount: 0,
    activeOwner: 'timer' as const,
    claimProjection: vi.fn<MockProjectionContext['claimProjection']>(),
    startProjection: vi.fn<MockProjectionContext['startProjection']>(() => Promise.resolve()),
    stopProjection: vi.fn<MockProjectionContext['stopProjection']>(() => Promise.resolve()),
    openProjection: vi.fn<MockProjectionContext['openProjection']>(() => Promise.resolve()),
    closeProjection: vi.fn<MockProjectionContext['closeProjection']>(() => Promise.resolve()),
    blankProjection: vi.fn<MockProjectionContext['blankProjection']>(),
    project: vi.fn<MockProjectionContext['project']>(() => Promise.resolve()),
    send: vi.fn<MockProjectionContext['send']>(),
    on: vi.fn(() => vi.fn()) as MockProjectionContext['on']
  }
}

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const element = (
    <ShortcutScopeProvider>
      <ConfirmDialogProvider>
        <Header />
        <ConfirmDialog />
      </ConfirmDialogProvider>
    </ShortcutScopeProvider>
  )
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/timer', element },
      { path: '/bible', element },
      { path: '/files', element }
    ],
    { initialEntries }
  )
  return render(<RouterProvider router={router} />)
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFileExplorerStore.setState({
      currentFolderId: 'file-root',
      _itemsArray: []
    })
    useBibleProjectionStore.getState().clearLastPayloads()
  })

  it('renders a header element', async () => {
    await i18n.changeLanguage('en')
    await mockProjectionContext()
    renderWithRouter(['/'])
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('starts timer projection from the timer route', async () => {
    await i18n.changeLanguage('en')
    const startProjection = vi.fn(() => Promise.resolve())
    await mockProjectionContext({ isProjectionOpen: false, startProjection })
    renderWithRouter(['/timer'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start projection' }))
    expect(startProjection).toHaveBeenCalledWith('timer')
  })

  it('disables bible projection start until a bible payload exists', async () => {
    await i18n.changeLanguage('en')
    await mockProjectionContext({ isProjectionOpen: false })
    renderWithRouter(['/bible'])
    expect(screen.getByRole('button', { name: 'Start projection' })).toBeDisabled()
  })

  it('replays the last bible projection payload from the bible route', async () => {
    await i18n.changeLanguage('en')
    const startProjection = vi.fn(() => Promise.resolve())
    const payloads: ContentMessageTuple[] = [
      ['bible:settings', { fontSize: 90 }],
      [
        'bible:chapter',
        {
          bookNumber: 43,
          chapter: 3,
          chapterVerses: [{ number: 16, text: 'For God so loved the world' }],
          currentVerse: 16
        }
      ]
    ]
    useBibleProjectionStore.getState().setLastPayloads(payloads)
    await mockProjectionContext({ isProjectionOpen: false, startProjection })

    renderWithRouter(['/bible'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start projection' }))

    expect(startProjection).toHaveBeenCalledWith('bible', payloads)
  })

  it('disables files projection start when the current folder has no presentable item', async () => {
    await i18n.changeLanguage('en')
    await mockProjectionContext({ isProjectionOpen: false })
    renderWithRouter(['/files'])
    expect(screen.getByRole('button', { name: 'Start projection' })).toBeDisabled()
  })

  it('starts presentation from the current files folder', async () => {
    await i18n.changeLanguage('en')
    await mockProjectionContext({ isProjectionOpen: false })
    const startPresentationWithReadiness = vi.fn(() =>
      Promise.resolve({ summary: { ready: 1, unsupported: 0, failed: 0 } })
    )
    useFileExplorerStore.setState({
      currentFolderId: 'file-root',
      _itemsArray: [makeFile('image-1')]
    })
    useMediaProjectionStore.setState({
      startPresentationWithReadiness
    } as never)

    renderWithRouter(['/files'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start projection' }))

    expect(startPresentationWithReadiness).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'image-1' })],
      0
    )
  })

  it('renders stop projection button with correct aria-label in English when open', async () => {
    await i18n.changeLanguage('en')
    await mockProjectionContext({ isProjectionOpen: true, isProjectionBlanked: false })
    renderWithRouter(['/'])
    expect(screen.getByRole('button', { name: 'Stop projection' })).toBeInTheDocument()
  })

  it('calls stopProjection after confirmation when projection is open', async () => {
    await i18n.changeLanguage('en')
    const stopProjection = vi.fn(() => Promise.resolve())
    await mockProjectionContext({ isProjectionOpen: true, stopProjection })

    renderWithRouter(['/'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Stop projection' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    expect(stopProjection).toHaveBeenCalled()
  })

  it.each(['/timer', '/bible', '/files'])(
    'only stops projection from %s when projection is already open',
    async (route) => {
      await i18n.changeLanguage('en')
      const stopProjection = vi.fn(() => Promise.resolve())
      const startProjection = vi.fn(() => Promise.resolve())
      await mockProjectionContext({ isProjectionOpen: true, stopProjection, startProjection })

      renderWithRouter([route])
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Stop projection' }))
      await user.click(await screen.findByRole('button', { name: 'Close' }))

      expect(stopProjection).toHaveBeenCalled()
      expect(startProjection).not.toHaveBeenCalled()
    }
  )

  it('renders stop projection button with correct aria-label in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    await mockProjectionContext({ isProjectionOpen: true, isProjectionBlanked: false })
    renderWithRouter(['/'])
    expect(screen.getByRole('button', { name: '停止投影' })).toBeInTheDocument()
    await act(() => i18n.changeLanguage('en'))
  })

  describe('route-aware ModeSelector', () => {
    it('shows ModeSelector tabs on /timer route', async () => {
      await i18n.changeLanguage('en')
      useTimerStore.setState({ mode: 'timer' })
      await mockProjectionContext()
      renderWithRouter(['/timer'])
      expect(screen.getByTestId('mode-timer')).toBeInTheDocument()
      expect(screen.getByTestId('mode-clock')).toBeInTheDocument()
      expect(screen.getByTestId('mode-both')).toBeInTheDocument()
      expect(screen.getByTestId('mode-stopwatch')).toBeInTheDocument()
    })

    it('hides ModeSelector on non-timer routes via opacity', async () => {
      await i18n.changeLanguage('en')
      await mockProjectionContext()
      renderWithRouter(['/'])
      const wrapper = screen.getByTestId('mode-timer')?.closest('.absolute')
      expect(wrapper?.className).toContain('opacity-0')
    })
  })
})
