import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationWorkspacePage, { PptxDocumentView } from '../PresentationWorkspacePage'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createTextElement
} from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE, PPTX_MIME_TYPE } from '@renderer/lib/presentation-media'
import { PresentationSessionRegistryProvider } from '@renderer/contexts/PresentationSessionRegistryContext'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  convertPptxToEditablePresentation: vi.fn(),
  loadEditablePresentation: vi.fn(),
  persistEditablePresentationRevision: vi.fn(),
  refreshEditablePresentationThumbnail: vi.fn(),
  navigate: vi.fn(),
  toastDanger: vi.fn(),
  readPresentationArrayBuffer: vi.fn(),
  openPptxViewer: vi.fn()
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

vi.mock('@heroui/react/toast', () => ({
  toast: { danger: mocks.toastDanger }
}))

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({ showMenu: vi.fn() })
}))

vi.mock('@renderer/lib/presentation-source', () => ({
  readPresentationArrayBuffer: mocks.readPresentationArrayBuffer
}))

vi.mock('@renderer/lib/pptx-renderer-service', () => ({
  openPptxViewer: mocks.openPptxViewer
}))

vi.mock('@renderer/lib/editable-presentation', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/editable-presentation')>(
    '@renderer/lib/editable-presentation'
  )
  return {
    ...actual,
    convertPptxToEditablePresentation: mocks.convertPptxToEditablePresentation,
    loadEditablePresentation: mocks.loadEditablePresentation
  }
})

vi.mock('@renderer/lib/editable-presentation-persistence', () => ({
  persistEditablePresentationRevision: mocks.persistEditablePresentationRevision,
  refreshEditablePresentationThumbnail: mocks.refreshEditablePresentationThumbnail
}))

function makeFile(overrides: Partial<FileItemRecord> = {}): FileItemRecord {
  return {
    id: 'deck-1',
    parentId: 'file-root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'Deck.pptx',
    url: 'blob:deck-1',
    size: 100,
    mimeType: PPTX_MIME_TYPE,
    ...overrides
  }
}

function renderReadOnlyDeck(sourceItem: FileItemRecord): void {
  useFileExplorerStore.setState({
    folders: {},
    items: { [sourceItem.id]: sourceItem },
    _foldersArray: [],
    _itemsArray: [sourceItem],
    _childFoldersByParent: {},
    _itemsByParent: { [sourceItem.parentId]: [sourceItem] },
    loadedParents: new Set([sourceItem.parentId]),
    currentFolderId: sourceItem.parentId,
    isLoading: false,
    isInitialized: true
  })
  usePresentationWorkspaceStore.getState().openDocument(sourceItem)
  const deck = usePresentationWorkspaceStore.getState().documents[0]
  if (!deck) throw new Error('workspace deck was not opened')
  render(<PptxDocumentView deck={deck} />)
}

function renderEditableDeck(sourceItem: FileItemRecord): void {
  useFileExplorerStore.setState({
    folders: {},
    items: { [sourceItem.id]: sourceItem },
    _foldersArray: [],
    _itemsArray: [sourceItem],
    _childFoldersByParent: {},
    _itemsByParent: { [sourceItem.parentId]: [sourceItem] },
    loadedParents: new Set([sourceItem.parentId]),
    currentFolderId: sourceItem.parentId,
    isLoading: false,
    isInitialized: true
  })
  usePresentationWorkspaceStore.getState().openDocument(sourceItem)
  render(
    <PresentationSessionRegistryProvider>
      <PresentationWorkspacePage />
    </PresentationSessionRegistryProvider>
  )
}

describe('PresentationWorkspacePage read-only PPTX edit copy', () => {
  beforeEach(() => {
    mocks.convertPptxToEditablePresentation.mockReset()
    mocks.loadEditablePresentation.mockReset()
    mocks.persistEditablePresentationRevision.mockReset()
    mocks.persistEditablePresentationRevision.mockImplementation(async (request) => ({
      revision: request.revision,
      mirrorWarnings: []
    }))
    mocks.refreshEditablePresentationThumbnail.mockReset()
    mocks.refreshEditablePresentationThumbnail.mockResolvedValue(undefined)
    mocks.navigate.mockReset()
    mocks.toastDanger.mockReset()
    mocks.readPresentationArrayBuffer.mockResolvedValue(new ArrayBuffer(8))
    mocks.openPptxViewer.mockResolvedValue({
      slideCount: 1,
      slideWidth: 1280,
      slideHeight: 720,
      destroy: vi.fn(),
      viewer: {
        renderSlide: vi.fn().mockResolvedValue(undefined),
        renderThumbnailToContainer: vi.fn(() => ({ dispose: vi.fn() }))
      }
    })
    usePresentationWorkspaceStore.setState({
      documents: [],
      activeItemId: null,
      activeSlideIdByItemId: {}
    })
  })

  it('opens the created editable item when Edit a copy succeeds', async () => {
    const sourceItem = makeFile()
    const createdItem = makeFile({
      id: 'editable-1',
      name: 'Deck Editable',
      url: 'blob:editable-1',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.convertPptxToEditablePresentation.mockResolvedValue(createdItem)

    renderReadOnlyDeck(sourceItem)
    fireEvent.click(screen.getByRole('button', { name: 'Edit a copy' }))

    await waitFor(() =>
      expect(mocks.convertPptxToEditablePresentation).toHaveBeenCalledWith(sourceItem)
    )
    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe('editable-1')
    expect(usePresentationWorkspaceStore.getState().documents.at(-1)).toMatchObject({
      itemId: 'editable-1',
      mode: 'editable'
    })
    expect(mocks.navigate).toHaveBeenCalledWith('/presentations/editable-1')
    expect(mocks.toastDanger).not.toHaveBeenCalled()
  })

  it('toasts and keeps the original read-only deck active when Edit a copy fails', async () => {
    const sourceItem = makeFile()
    mocks.convertPptxToEditablePresentation.mockRejectedValue(new Error('conversion failed'))

    renderReadOnlyDeck(sourceItem)
    fireEvent.click(screen.getByRole('button', { name: 'Edit a copy' }))

    await waitFor(() => expect(mocks.toastDanger).toHaveBeenCalledWith('conversion failed'))
    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe('deck-1')
    expect(usePresentationWorkspaceStore.getState().documents).toHaveLength(1)
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Edit a copy' })).toBeEnabled()
  })

  it('keeps Home, Insert, and Design ribbon panels at the same height', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentation.mockResolvedValue(document)

    renderEditableDeck(sourceItem)

    const frame = await screen.findByTestId('presentation-ribbon-frame')
    expect(frame).toHaveClass('h-24')

    fireEvent.click(screen.getByRole('button', { name: '插入' }))
    expect(frame).toHaveClass('h-24')

    fireEvent.click(screen.getByRole('button', { name: '設計' }))
    expect(frame).toHaveClass('h-24')
  })

  it('updates selected text box height from numeric controls', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Height', width: 220, height: 40, autoWidth: false })
    const withText = addElementToSlide(document, slideId, text)
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentation.mockResolvedValue(withText)

    renderEditableDeck(sourceItem)

    const textBoxes = await screen.findAllByRole('textbox')
    const mainTextBox = textBoxes[textBoxes.length - 1]
    if (!mainTextBox) throw new Error('main text box not found')
    fireEvent.click(mainTextBox)
    fireEvent.change(screen.getByLabelText('height'), { target: { value: '96' } })

    await waitFor(() =>
      expect(mocks.persistEditablePresentationRevision).toHaveBeenLastCalledWith(
        expect.objectContaining({
          itemId: 'editable-deck',
          sourceBlobId: 'editable-deck',
          document: expect.objectContaining({
            slides: expect.objectContaining({
              [slideId]: expect.objectContaining({
                elements: expect.objectContaining({
                  [text.id]: expect.objectContaining({ height: 96 })
                })
              })
            })
          })
        })
      )
    )
  })
})
