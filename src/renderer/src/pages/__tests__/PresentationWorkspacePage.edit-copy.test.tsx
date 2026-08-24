import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationWorkspacePage, { PptxDocumentView } from '../PresentationWorkspacePage'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createImageElement,
  createTextElement,
  insertBlankEditableSlide
} from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE, PPTX_MIME_TYPE } from '@renderer/lib/presentation-media'
import { PresentationSessionRegistryProvider } from '@renderer/contexts/PresentationSessionRegistryContext'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  convertPptxToEditablePresentation: vi.fn(),
  loadEditablePresentationSnapshot: vi.fn(),
  persistEditablePresentationRevision: vi.fn(),
  refreshEditablePresentationThumbnail: vi.fn(),
  navigate: vi.fn(),
  toastDanger: vi.fn(),
  toastWarning: vi.fn(),
  readPresentationArrayBuffer: vi.fn(),
  openPptxViewer: vi.fn(),
  prepareHhcLinePresentationSource: vi.fn(),
  session: null as { userId: string; displayName: string; roles: string[] } | null
}))

vi.mock('@renderer/contexts/HhcAuthContext', () => ({
  useHhcAuth: () => ({
    session: mocks.session,
    getAuthGeneration: vi.fn(() => 0),
    getAccessToken: vi.fn(async () => null),
    refreshAccessToken: vi.fn(async () => null),
    endSession: vi.fn(async () => undefined)
  })
}))

vi.mock('@renderer/lib/hhc-line-connect', () => ({
  prepareHhcLinePresentationSource: mocks.prepareHhcLinePresentationSource
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
  toast: { danger: mocks.toastDanger, warning: mocks.toastWarning }
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
    loadEditablePresentationSnapshot: mocks.loadEditablePresentationSnapshot
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
    mocks.loadEditablePresentationSnapshot.mockReset()
    mocks.persistEditablePresentationRevision.mockReset()
    mocks.persistEditablePresentationRevision.mockImplementation(async (request) => ({
      revision: request.revision,
      mirrorWarnings: []
    }))
    mocks.refreshEditablePresentationThumbnail.mockReset()
    mocks.refreshEditablePresentationThumbnail.mockResolvedValue(undefined)
    mocks.navigate.mockReset()
    mocks.toastDanger.mockReset()
    mocks.toastWarning.mockReset()
    mocks.readPresentationArrayBuffer.mockResolvedValue(new ArrayBuffer(8))
    mocks.prepareHhcLinePresentationSource.mockReset()
    mocks.prepareHhcLinePresentationSource.mockResolvedValue(null)
    mocks.session = null
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

  it('loads an online LINE PPTX through its ephemeral source', async () => {
    const sourceItem = makeFile({ url: 'unsupported:hhc-line-online' })
    mocks.session = { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    mocks.prepareHhcLinePresentationSource.mockResolvedValue({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      rootRemoteFolderId: 'collection-1',
      source: {
        kind: 'ticket',
        url: 'https://www.alive.org.tw/api/assets/content?ticket=pptx-secret',
        expiresAt: Date.now() + 60_000,
        etag: 'etag-1'
      }
    })

    renderReadOnlyDeck(sourceItem)

    await waitFor(() =>
      expect(mocks.readPresentationArrayBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sourceItem.id,
          url: 'https://www.alive.org.tw/api/assets/content?ticket=pptx-secret'
        })
      )
    )
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

  it('uses the shared responsive shell for read-only PPTX', async () => {
    renderReadOnlyDeck(makeFile())

    await screen.findByRole('button', { name: 'Edit a copy' })
    const group = window.document.querySelector('.workspace-panel-group')
    expect(group).not.toBeNull()
    expect(
      group!.querySelector('.workspace-navigator-slot [data-workspace-navigator]')
    ).not.toBeNull()
    expect(group!.querySelector('.workspace-stage-slot main')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Slides' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens and closes mutually exclusive compact panels from existing commands', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

    renderEditableDeck(sourceItem)
    const ribbonFrame = await screen.findByTestId('presentation-ribbon-frame')
    fireEvent.click(screen.getByRole('button', { name: '設計' }))
    const formatBackgroundTrigger = within(ribbonFrame).getByRole('button', {
      name: 'Format Background'
    })
    fireEvent.click(formatBackgroundTrigger)

    const navigatorSlot = window.document.querySelector('.workspace-navigator-slot')
    let inspectorSlot = window.document.querySelector('.workspace-inspector-slot')
    expect(inspectorSlot).toHaveClass('workspace-overlay-open')
    expect(navigatorSlot).not.toHaveClass('workspace-overlay-open')

    fireEvent.click(screen.getByRole('button', { name: 'Close Format Background' }))
    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()
    await waitFor(() => expect(formatBackgroundTrigger).toHaveFocus())

    fireEvent.click(formatBackgroundTrigger)
    inspectorSlot = window.document.querySelector('.workspace-inspector-slot')
    expect(inspectorSlot).toHaveClass('workspace-overlay-open')
    const inspectorContentClose = within(inspectorSlot as HTMLElement).getByRole('button', {
      name: 'common.close'
    })
    expect(inspectorContentClose).toHaveClass('workspace-inspector-content-close')
    fireEvent.click(inspectorContentClose)
    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()
    await waitFor(() => expect(formatBackgroundTrigger).toHaveFocus())

    fireEvent.click(formatBackgroundTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Slides' }))
    expect(navigatorSlot).toHaveClass('workspace-overlay-open')
    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close Slides' }))
    expect(navigatorSlot).not.toHaveClass('workspace-overlay-open')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Slides' })).toHaveFocus())
  })

  it('closes Format Background when leaving Design without moving focus from the selected tab', async () => {
    const user = userEvent.setup()
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

    renderEditableDeck(sourceItem)
    const ribbonFrame = await screen.findByTestId('presentation-ribbon-frame')
    await user.click(screen.getByRole('button', { name: '設計' }))
    await user.click(within(ribbonFrame).getByRole('button', { name: 'Format Background' }))

    const insertTab = screen.getByRole('button', { name: '插入' })
    await user.click(insertTab)

    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()
    expect(insertTab).toHaveFocus()
  })

  it('closes Format Background when collapsing Design without moving focus from Design', async () => {
    const user = userEvent.setup()
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

    renderEditableDeck(sourceItem)
    const ribbonFrame = await screen.findByTestId('presentation-ribbon-frame')
    const designTab = screen.getByRole('button', { name: '設計' })
    await user.click(designTab)
    await user.click(within(ribbonFrame).getByRole('button', { name: 'Format Background' }))

    await user.click(designTab)

    expect(ribbonFrame).toHaveClass('h-0')
    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()
    expect(designTab).toHaveFocus()
  })

  it('keeps Home, Insert, and Design ribbon panels at the same native height', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

    renderEditableDeck(sourceItem)

    const frame = await screen.findByTestId('presentation-ribbon-frame')
    expect(frame).toHaveClass('h-28')

    fireEvent.click(screen.getByRole('button', { name: '插入' }))
    expect(frame).toHaveClass('h-28')

    fireEvent.click(screen.getByRole('button', { name: '設計' }))
    expect(frame).toHaveClass('h-28')
  })

  it('does not mount off-screen editable slide previews', async () => {
    const originalIntersectionObserver = window.IntersectionObserver
    class TestIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0]
      disconnect = vi.fn()
      observe = vi.fn()
      takeRecords = vi.fn(() => [])
      unobserve = vi.fn()

      constructor(callback: IntersectionObserverCallback) {
        void callback
      }
    }
    window.IntersectionObserver = TestIntersectionObserver

    try {
      let document = createBlankEditablePresentationDocument('Sunday')
      document = insertBlankEditableSlide(document, 1).document
      document = insertBlankEditableSlide(document, 2).document
      const sourceItem = makeFile({
        id: 'editable-deck',
        name: 'Sunday Editable',
        url: 'blob:editable-deck',
        mimeType: EDITABLE_PRESENTATION_MIME_TYPE
      })
      mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

      renderEditableDeck(sourceItem)

      await screen.findByTestId('presentation-ribbon-frame')
      expect(window.document.querySelectorAll('[data-slide-surface]')).toHaveLength(1)
    } finally {
      if (originalIntersectionObserver) {
        window.IntersectionObserver = originalIntersectionObserver
      } else {
        Reflect.deleteProperty(window, 'IntersectionObserver')
      }
    }
  })

  it('orders Home commands in native Ribbon groups', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

    renderEditableDeck(sourceItem)

    await screen.findByTestId('presentation-ribbon-frame')
    const groups = screen.getAllByTestId('presentation-ribbon-group')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Font',
      'Paragraph',
      'Position',
      'Arrange'
    ])
    groups.forEach((group) => expect(group).toHaveClass('shrink-0'))
    const surface = window.document.querySelector('[data-ribbon-surface]')
    expect(surface).toHaveClass('overflow-x-auto', 'overflow-y-hidden')
    expect(screen.getByRole('group', { name: 'Arrange' }).querySelector('.flex-wrap')).toBeNull()
    ;[
      'Align objects left',
      'Align objects center',
      'Align objects right',
      'Align objects top',
      'Align objects middle',
      'Align objects bottom',
      'Distribute objects horizontally',
      'Distribute objects vertically'
    ].forEach((name) => expect(screen.getByRole('button', { name })).toHaveTextContent(''))
  })

  it('loads local font families from a user action', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })
    const queryLocalFonts = vi
      .fn()
      .mockResolvedValue([{ family: 'PingFang TC' }, { family: 'PingFang TC' }])
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: queryLocalFonts
    })

    renderEditableDeck(sourceItem)
    fireEvent.click(await screen.findByRole('button', { name: 'Load local fonts' }))

    expect(await screen.findByRole('option', { name: 'PingFang TC' })).toBeInTheDocument()
    expect(queryLocalFonts).toHaveBeenCalledOnce()

    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  it('keeps an imported font family selectable before local fonts are loaded', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({
      text: 'Imported font',
      width: 300,
      height: 80,
      autoWidth: false,
      fontFamily: 'Aptos'
    })
    const withText = addElementToSlide(document, slideId, text)
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document: withText, revision: 0 })

    renderEditableDeck(sourceItem)
    const textBoxes = await screen.findAllByRole('textbox')
    fireEvent.click(textBoxes.at(-1)!)

    expect(screen.getByRole('option', { name: 'Aptos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Font family')).toHaveValue('Aptos')
  })

  it('uses the same Ribbon group shell for Insert and Design', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })

    renderEditableDeck(sourceItem)
    await screen.findByTestId('presentation-ribbon-frame')

    fireEvent.click(screen.getByRole('button', { name: '插入' }))
    expect(screen.getByRole('group', { name: 'Insert' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '設計' }))
    expect(screen.getByRole('group', { name: 'Background' })).toBeInTheDocument()
  })

  it('groups Picture Format commands as Adjust, Arrange, and Size', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const image = createImageElement({
      assetId: 'asset-1',
      slideWidth: document.width,
      slideHeight: document.height,
      sourceWidth: 640,
      sourceHeight: 360
    })
    const withImage = addElementToSlide(document, slideId, image)
    withImage.assets['asset-1'] = {
      id: 'asset-1',
      name: 'Worship image',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA=='
    }
    const sourceItem = makeFile({
      id: 'editable-deck',
      name: 'Sunday Editable',
      url: 'blob:editable-deck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document: withImage, revision: 0 })

    renderEditableDeck(sourceItem)
    const imageElement = (await screen.findAllByRole('img', { name: 'Worship image' }))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(imageElement).not.toBeNull()
    fireEvent.pointerDown(imageElement!, { clientX: 10, clientY: 10 })
    fireEvent.click(await screen.findByRole('button', { name: '圖片格式' }))

    expect(
      screen
        .getAllByTestId('presentation-ribbon-group')
        .map((group) => group.getAttribute('aria-label'))
    ).toEqual(['Adjust', 'Arrange', 'Size'])
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
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document: withText, revision: 0 })

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
