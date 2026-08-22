import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useFileContextMenu } from '../useFileContextMenu'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showMenu: vi.fn(),
  startMediaProjection: vi.fn()
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({ showMenu: mocks.showMenu })
}))

vi.mock('@renderer/lib/projection-actions', () => ({
  startMediaProjection: mocks.startMediaProjection
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { warning: vi.fn() }
}))

const image: FileItemRecord = {
  id: 'image-1',
  parentId: 'root',
  type: 'file',
  name: 'Photo.png',
  url: 'blob:image-1',
  mimeType: 'image/png',
  size: 100,
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null
}

function ContextMenuProbe(): React.JSX.Element {
  const menu = useFileContextMenu()
  return (
    <button
      onClick={() => {
        menu.showItemMenu({
          item: image,
          isAlreadySelected: true,
          event: { preventDefault: vi.fn(), stopPropagation: vi.fn() } as never,
          setSelected: vi.fn(),
          onCopy: vi.fn(),
          onCut: vi.fn(),
          onDelete: vi.fn()
        })
      }}
    >
      Open menu
    </button>
  )
}

function openProjectMenu(): () => void {
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

  const project = mocks.showMenu.mock.calls
    .at(-1)?.[0]
    .find((entry: ContextMenuEntry) => entry !== 'separator' && entry.id === 'project')
  if (!project || project === 'separator') throw new Error('Project action missing')
  return project.onAction
}

describe('useFileContextMenu project action', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.showMenu.mockReset()
    mocks.startMediaProjection.mockReset()
    useFileExplorerStore.setState({
      currentFolderId: 'root',
      items: { [image.id]: image },
      _itemsArray: [image],
      _itemsByParent: { root: [image] }
    })
    render(
      <MemoryRouter>
        <ContextMenuProbe />
      </MemoryRouter>
    )
  })

  it('enters Media after Project prepares an item', async () => {
    mocks.startMediaProjection.mockResolvedValue({ summary: { ready: 1 }, items: [] })

    act(() => openProjectMenu()())

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/media'))
  })

  it('keeps the current route when Project prepares no items', async () => {
    mocks.startMediaProjection.mockResolvedValue({ summary: { ready: 0 }, items: [] })

    act(() => openProjectMenu()())

    await act(async () => Promise.resolve())
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('keeps the current route when Project preparation rejects', async () => {
    mocks.startMediaProjection.mockRejectedValue(new Error('preparation failed'))

    act(() => openProjectMenu()())

    await act(async () => Promise.resolve())
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
