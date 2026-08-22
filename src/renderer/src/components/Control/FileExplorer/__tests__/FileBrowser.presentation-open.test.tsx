import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileBrowser from '../FileBrowser'
import {
  FILE_EXPLORER_ROOT_ID,
  useFileExplorerSearch,
  useFileExplorerSettings,
  useFileExplorerStore
} from '@renderer/stores/file-explorer'
import { EDITABLE_PRESENTATION_MIME_TYPE, PPTX_MIME_TYPE } from '@renderer/lib/presentation-media'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  startMediaProjection: vi.fn()
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  }
})

vi.mock('@renderer/lib/projection-actions', () => ({
  startMediaProjection: mocks.startMediaProjection
}))

vi.mock('@renderer/contexts/ConfirmDialogContext', () => ({
  useConfirm: () => vi.fn(async () => true)
}))

vi.mock('@heroui/react/toast', () => ({
  toast: {
    warning: vi.fn(),
    danger: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('@renderer/lib/sync-db', () => ({
  SYNC_ENTRY_CHANGED_EVENT: 'hhc:test-sync-entry-changed',
  listSyncEntries: vi.fn(() => new Promise(() => {}))
}))

vi.mock('@renderer/hooks/useThumbnails', () => ({
  canHaveThumbnail: () => false,
  useThumbnails: () => ({})
}))

function makeRootFolder(): FolderRecord {
  return {
    id: FILE_EXPLORER_ROOT_ID,
    name: 'Files',
    parentId: null,
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null
  }
}

function makeFile(overrides: Partial<FileItemRecord>): FileItemRecord {
  return {
    id: 'file-1',
    parentId: FILE_EXPLORER_ROOT_ID,
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'file.png',
    url: 'blob:file-1',
    size: 100,
    mimeType: 'image/png',
    ...overrides
  }
}

async function renderWithItems(items: readonly FileItemRecord[]): Promise<void> {
  const root = makeRootFolder()
  act(() => {
    useFileExplorerStore.setState({
      folders: { [root.id]: root },
      items: Object.fromEntries(items.map((item) => [item.id, item])),
      _foldersArray: [root],
      _itemsArray: [...items],
      _childFoldersByParent: { [FILE_EXPLORER_ROOT_ID]: [] },
      _itemsByParent: { [FILE_EXPLORER_ROOT_ID]: [...items] },
      loadedParents: new Set([FILE_EXPLORER_ROOT_ID]),
      currentFolderId: FILE_EXPLORER_ROOT_ID,
      isLoading: false,
      isInitialized: true
    })
  })

  render(<FileBrowser />)
  await act(async () => undefined)
}

describe('FileBrowser presentation open behavior', () => {
  beforeEach(() => {
    mocks.navigate.mockClear()
    mocks.startMediaProjection.mockClear()
    act(() => {
      usePresentationWorkspaceStore.setState({
        documents: [],
        activeItemId: null,
        activeSlideIdByItemId: {}
      })
      useFileExplorerSearch.setState({ searchQuery: '' })
      useFileExplorerSettings.setState({
        viewMode: 'medium-icon',
        sortField: 'createdAt',
        sortDir: 'none'
      })
    })
  })

  it('opens an imported PPTX in the safe preview when double-clicked', async () => {
    const deck = makeFile({ id: 'deck-1', name: 'Deck.pptx', mimeType: PPTX_MIME_TYPE })
    await renderWithItems([deck])

    act(() => {
      fireEvent.doubleClick(screen.getByText('Deck.pptx'))
    })

    expect(usePresentationWorkspaceStore.getState().activeItemId).toBeNull()
    expect(usePresentationWorkspaceStore.getState().documents).toEqual([])
    expect(mocks.navigate).toHaveBeenCalledWith('/files/preview/deck-1')
    expect(mocks.startMediaProjection).not.toHaveBeenCalled()
  })

  it('opens ordinary media in the safe preview without projecting', async () => {
    const image = makeFile({ id: 'image-1', name: 'Photo.png', mimeType: 'image/png' })
    await renderWithItems([image])

    act(() => {
      fireEvent.doubleClick(screen.getByText('Photo.png'))
    })

    expect(mocks.startMediaProjection).not.toHaveBeenCalled()
    expect(usePresentationWorkspaceStore.getState().documents).toEqual([])
    expect(mocks.navigate).toHaveBeenCalledWith('/files/preview/image-1')
  })

  it('opens an editable presentation in the presentation workspace', async () => {
    const deck = makeFile({
      id: 'deck-1',
      name: 'Deck.presentation',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    await renderWithItems([deck])

    act(() => {
      fireEvent.doubleClick(screen.getByText('Deck.presentation'))
    })

    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe('deck-1')
    expect(mocks.navigate).toHaveBeenCalledWith('/presentations/deck-1')
    expect(mocks.startMediaProjection).not.toHaveBeenCalled()
  })

  it('opens an imported PPTX search result in the safe preview', async () => {
    const deck = makeFile({ id: 'deck-1', name: 'Deck.pptx', mimeType: PPTX_MIME_TYPE })
    act(() => {
      useFileExplorerSearch.setState({ searchQuery: 'Deck' })
    })
    await renderWithItems([deck])

    act(() => {
      fireEvent.doubleClick(screen.getByText('Deck.pptx'))
    })

    expect(usePresentationWorkspaceStore.getState().activeItemId).toBeNull()
    expect(mocks.navigate).toHaveBeenCalledWith('/files/preview/deck-1')
    expect(mocks.startMediaProjection).not.toHaveBeenCalled()
  })

  it('shows safe error health for an access-revoked sync root', async () => {
    const root = makeRootFolder()
    const revoked: FolderRecord = {
      id: 'revoked-root',
      name: 'Revoked collection',
      parentId: FILE_EXPLORER_ROOT_ID,
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'hhc-line:user-1',
        providerType: 'hhc-line',
        remoteFolderId: 'collection-1',
        offlinePolicy: 'online-only',
        status: 'access-revoked'
      }
    }
    act(() => {
      useFileExplorerStore.setState({
        folders: { [root.id]: root, [revoked.id]: revoked },
        items: {},
        _foldersArray: [root, revoked],
        _itemsArray: [],
        _childFoldersByParent: { [FILE_EXPLORER_ROOT_ID]: [revoked] },
        _itemsByParent: { [FILE_EXPLORER_ROOT_ID]: [] },
        loadedParents: new Set([FILE_EXPLORER_ROOT_ID]),
        currentFolderId: FILE_EXPLORER_ROOT_ID,
        isLoading: false,
        isInitialized: true
      })
    })

    render(<FileBrowser />)

    expect(await screen.findByLabelText('Sync error')).toBeInTheDocument()
    expect(screen.queryByText(/401|403|authorization|forbidden/i)).not.toBeInTheDocument()
  })
})
