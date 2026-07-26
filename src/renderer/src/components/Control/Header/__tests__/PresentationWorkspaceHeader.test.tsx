import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PresentationWorkspaceHeader from '../PresentationWorkspaceHeader'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import { createBlankEditablePresentationDocument } from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '@renderer/lib/presentation-media'
import type {
  PresentationEditorSession,
  PresentationSessionSnapshot
} from '@renderer/lib/presentation-editor-session'
import type { PresentationSessionRegistry } from '@renderer/contexts/PresentationSessionRegistryContext'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  registry: null as PresentationSessionRegistry | null,
  requestCloseDecision: vi.fn(),
  openFileExplorerDB: vi.fn(),
  loadEditablePresentation: vi.fn(),
  startMediaProjection: vi.fn(),
  stopProjectionSession: vi.fn()
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    isProjectionOpen: false,
    stopProjection: vi.fn()
  })
}))

vi.mock('@renderer/contexts/PresentationSessionRegistryContext', async () => {
  const actual = await vi.importActual<
    typeof import('@renderer/contexts/PresentationSessionRegistryContext')
  >('@renderer/contexts/PresentationSessionRegistryContext')
  return {
    ...actual,
    usePresentationSessionRegistry: () => mocks.registry
  }
})

vi.mock('@renderer/contexts/PresentationCloseDecisionContext', () => ({
  usePresentationCloseDecision: () => mocks.requestCloseDecision
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: mocks.openFileExplorerDB
}))

vi.mock('@renderer/lib/editable-presentation', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/editable-presentation')>(
    '@renderer/lib/editable-presentation'
  )
  return {
    ...actual,
    loadEditablePresentation: mocks.loadEditablePresentation
  }
})

vi.mock('@renderer/lib/projection-actions', () => ({
  startMediaProjection: mocks.startMediaProjection,
  stopProjectionSession: mocks.stopProjectionSession
}))

function makeEditableItem(id = 'deck-1'): FileItemRecord {
  return {
    id,
    parentId: 'file-root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'Sunday.lpdeck',
    url: `blob:${id}`,
    size: 1024,
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE
  }
}

function createFakeSession(item: FileItemRecord): PresentationEditorSession {
  const document = { ...createBlankEditablePresentationDocument('Sunday'), id: item.id }
  const snapshot: PresentationSessionSnapshot = {
    history: { past: [], present: document, future: [] },
    save: {
      status: 'saved',
      scheduledRevision: 0,
      persistedRevision: 0,
      error: null,
      mirrorWarnings: []
    },
    draftKind: null,
    renderedDocument: document
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    commit: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    beginDraft: vi.fn(),
    previewDraft: vi.fn(),
    commitDraft: vi.fn(),
    cancelDraft: vi.fn(),
    rename: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    discard: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn()
  }
}

function createRegistry(session: PresentationEditorSession): PresentationSessionRegistry {
  return {
    open: vi.fn().mockResolvedValue(session),
    get: vi.fn(() => session),
    activate: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
    flushAll: vi.fn().mockResolvedValue(undefined),
    discardAll: vi.fn().mockResolvedValue(undefined),
    hasUnsafeWork: vi.fn(() => false),
    getUnsafeItemIds: vi.fn(() => []),
    subscribe: vi.fn(() => () => undefined)
  }
}

function renderHeader(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <ShortcutScopeProvider>
        <PresentationWorkspaceHeader />
      </ShortcutScopeProvider>
    </MemoryRouter>
  )
}

describe('PresentationWorkspaceHeader', () => {
  let item: FileItemRecord
  let session: PresentationEditorSession
  let db: {
    get: ReturnType<typeof vi.fn>
    getAllFromIndex: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    item = makeEditableItem()
    session = createFakeSession(item)
    mocks.registry = createRegistry(session)
    mocks.requestCloseDecision.mockResolvedValue('keep-editing')
    db = {
      get: vi.fn().mockResolvedValue(item),
      getAllFromIndex: vi.fn().mockResolvedValue([item]),
      put: vi.fn().mockResolvedValue(undefined)
    }
    mocks.openFileExplorerDB.mockResolvedValue(db)
    mocks.startMediaProjection.mockResolvedValue({
      summary: { ready: 1, unsupported: 0, failed: 0 }
    })
    useFileExplorerStore.setState({
      items: { [item.id]: item },
      _itemsArray: [item]
    })
    useMediaProjectionStore.getState().exit()
    usePresentationWorkspaceStore.setState({
      documents: [],
      activeItemId: null,
      activeSlideIdByItemId: {}
    })
    usePresentationWorkspaceStore.getState().openDocument(item)
    usePresentationWorkspaceStore.getState().updateEditorMetadata(item.id, {
      saveStatus: 'saved',
      mirrorWarnings: [],
      canUndo: false,
      canRedo: false
    })
  })

  it('runs session Undo and Redo with truthful disabled states', async () => {
    const user = userEvent.setup()
    usePresentationWorkspaceStore.getState().updateEditorMetadata(item.id, {
      canUndo: true,
      canRedo: true
    })
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await user.click(screen.getByRole('button', { name: 'Redo' }))

    expect(session.undo).toHaveBeenCalledTimes(1)
    expect(session.redo).toHaveBeenCalledTimes(1)
  })

  it('shows save failure and retries the active session', async () => {
    const user = userEvent.setup()
    usePresentationWorkspaceStore.getState().updateEditorMetadata(item.id, {
      saveStatus: 'error',
      mirrorWarnings: ['thumbnail'],
      canUndo: false,
      canRedo: false
    })
    renderHeader()

    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(screen.getByText('Preview needs repair')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry save' }))

    expect(session.retry).toHaveBeenCalledTimes(1)
  })

  it('flushes through the registry before activating another tab', async () => {
    const secondItem = makeEditableItem('deck-2')
    secondItem.name = 'Sermon.lpdeck'
    usePresentationWorkspaceStore.getState().openDocument(secondItem)
    usePresentationWorkspaceStore.getState().setActiveDocument(item.id)
    renderHeader()

    fireEvent.click(screen.getByText('Sermon.lpdeck'))

    await waitFor(() => expect(mocks.registry!.activate).toHaveBeenCalledWith(secondItem.id))
    expect(mocks.navigate).toHaveBeenCalledWith('/presentations/deck-2')
  })

  it('asks for a close decision after flush fails and can discard', async () => {
    vi.mocked(mocks.registry!.close).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    mocks.requestCloseDecision.mockResolvedValue('discard')
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Close tab' }))

    await waitFor(() => {
      expect(mocks.requestCloseDecision).toHaveBeenCalledWith([item.id])
      expect(mocks.registry!.close).toHaveBeenLastCalledWith(item.id, 'discard')
    })
  })

  it('renames an editable document through its session and flushes before updating labels', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.dblClick(screen.getByText('Sunday.lpdeck'))
    const input = screen.getByRole('textbox', { name: 'Rename file' })
    await user.clear(input)
    await user.type(input, 'Worship')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(session.rename).toHaveBeenCalledWith('Worship', 'Worship.lpdeck')
      expect(session.flush).toHaveBeenCalledTimes(1)
    })
    expect(mocks.loadEditablePresentation).not.toHaveBeenCalled()
    expect(usePresentationWorkspaceStore.getState().documents[0].name).toBe('Worship.lpdeck')
  })

  it('does not start projection when the active session cannot flush', async () => {
    const user = userEvent.setup()
    vi.mocked(session.flush).mockRejectedValue(new Error('quota exceeded'))
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'projection.startButton' }))

    await waitFor(() => expect(session.flush).toHaveBeenCalledTimes(1))
    expect(session.commitDraft).toHaveBeenCalledTimes(1)
    expect(mocks.startMediaProjection).not.toHaveBeenCalled()
    expect(useMediaProjectionStore.getState().isPresenting).toBe(false)
  })

  it('starts projection with the flushed editable slide state in one store transition', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'projection.startButton' }))

    await waitFor(() => {
      expect(mocks.startMediaProjection).toHaveBeenCalledWith([item], 0, expect.any(Object), {
        prioritizeStartItem: true,
        presentationState: { slideIndex: 0, slideCount: 1 }
      })
    })
    expect(session.commitDraft).toHaveBeenCalledTimes(1)
    expect(session.flush).toHaveBeenCalledTimes(1)
  })

  it('keeps native text Undo while presentation shortcuts target the session', () => {
    usePresentationWorkspaceStore.getState().updateEditorMetadata(item.id, {
      canUndo: true,
      canRedo: true
    })
    renderHeader()

    fireEvent.keyDown(document, { code: 'KeyZ', key: 'z', ctrlKey: true })
    fireEvent.keyDown(document, { code: 'KeyY', key: 'y', ctrlKey: true })
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { code: 'KeyZ', key: 'z', ctrlKey: true })
    input.remove()

    expect(session.undo).toHaveBeenCalledTimes(1)
    expect(session.redo).toHaveBeenCalledTimes(1)
  })
})
