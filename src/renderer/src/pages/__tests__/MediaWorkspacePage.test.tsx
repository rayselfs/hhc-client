import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaWorkspacePage from '../MediaWorkspacePage'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

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
    useMediaProjectionStore.getState().endLiveSession()
  })

  it('ends the live session before leaving the controls', async () => {
    useMediaProjectionStore.setState({ isPresenting: true })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Exit Media' }))

    await screen.findByText('Files')
    expect(useMediaProjectionStore.getState().isPresenting).toBe(false)
  })

  it('leaves an empty Media route when no live session exists', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Files')).toBeInTheDocument())
  })
})
