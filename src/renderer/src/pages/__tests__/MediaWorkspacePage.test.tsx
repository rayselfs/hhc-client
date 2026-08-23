import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaWorkspacePage from '../MediaWorkspacePage'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const mocks = vi.hoisted(() => ({
  stopProjection: vi.fn<() => Promise<void>>(),
  danger: vi.fn()
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({ stopProjection: mocks.stopProjection })
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { danger: mocks.danger }
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@renderer/components/Control/FileExplorer/Presenter/MediaPresenter', () => ({
  default: ({ onExit }: { onExit: () => void }) => (
    <button type="button" onClick={onExit}>
      Exit Media
    </button>
  )
}))

function renderPage(): void {
  const router = createMemoryRouter(
    [
      { path: '/files', element: <div>Files</div> },
      { path: '/media', element: <MediaWorkspacePage /> }
    ],
    { initialEntries: ['/media'] }
  )
  render(<RouterProvider router={router} />)
}

describe('MediaWorkspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stopProjection.mockResolvedValue(undefined)
    useMediaProjectionStore.getState().endLiveSession()
  })

  it('closes projection before ending the live session and leaving the controls', async () => {
    let finishClose: (() => void) | undefined
    mocks.stopProjection.mockReturnValue(
      new Promise<void>((resolve) => {
        finishClose = resolve
      })
    )
    useMediaProjectionStore.setState({ isPresenting: true })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Exit Media' }))

    expect(mocks.stopProjection).toHaveBeenCalledOnce()
    expect(useMediaProjectionStore.getState().isPresenting).toBe(true)
    expect(screen.getByRole('button', { name: 'Exit Media' })).toBeInTheDocument()

    finishClose?.()
    await screen.findByText('Files')
    expect(useMediaProjectionStore.getState().isPresenting).toBe(false)
  })

  it('keeps the live session and controls when projection close fails', async () => {
    mocks.stopProjection.mockRejectedValue(new Error('close failed'))
    useMediaProjectionStore.setState({ isPresenting: true })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Exit Media' }))

    await waitFor(() => expect(mocks.danger).toHaveBeenCalledWith('toast.projectionCloseFailed'))
    expect(useMediaProjectionStore.getState().isPresenting).toBe(true)
    expect(screen.getByRole('button', { name: 'Exit Media' })).toBeInTheDocument()
  })

  it('leaves an empty Media route when no live session exists', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Files')).toBeInTheDocument())
  })
})
