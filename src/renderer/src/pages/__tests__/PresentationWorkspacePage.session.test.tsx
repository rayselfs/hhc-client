import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import PresentationWorkspacePage from '../PresentationWorkspacePage'
import PresentationWorkspaceHeader from '@renderer/components/Control/Header/PresentationWorkspaceHeader'
import PresentationNavigationGuard from '@renderer/components/Control/PresentationNavigationGuard'
import PresentationElectronCloseBridge from '@renderer/contexts/PresentationElectronCloseBridge'
import {
  PresentationSessionRegistryProvider,
  usePresentationSessionRegistry,
  type PresentationSessionRegistry
} from '@renderer/contexts/PresentationSessionRegistryContext'
import type { PresentationEditorSession } from '@renderer/lib/presentation-editor-session'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createImageElement,
  createTextElement,
  insertBlankEditableSlide,
  removeEditableSlides
} from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '@renderer/lib/presentation-media'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import { openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  loadEditablePresentationSnapshot: vi.fn(),
  persistEditablePresentationRevision: vi.fn(),
  refreshEditablePresentationThumbnail: vi.fn(),
  queryLocalFontFamiliesOnce: vi.fn(),
  supportsLocalFontAccess: vi.fn(),
  showMenu: vi.fn(),
  toastWarning: vi.fn(),
  toastDanger: vi.fn(),
  startMediaProjection: vi.fn(),
  requestCloseDecision: vi.fn()
}))

interface ResizeObserverRecord {
  callback: ResizeObserverCallback
  targets: Set<Element>
}

let resizeObserverRecords: ResizeObserverRecord[] = []

function resizeElement(element: Element, width: number, height: number): void {
  const record = resizeObserverRecords.find(({ targets }) => targets.has(element))
  expect(record).toBeDefined()
  act(() =>
    record!.callback(
      [
        {
          target: element,
          contentRect: new DOMRect(0, 0, width, height)
        } as ResizeObserverEntry
      ],
      {} as ResizeObserver
    )
  )
}

function mockAnimationFrame(): () => void {
  let nextFrameId = 0
  const frames = new Map<number, FrameRequestCallback>()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const frameId = ++nextFrameId
    frames.set(frameId, callback)
    return frameId
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
    frames.delete(frameId)
  })

  return () => {
    const pendingFrames = [...frames.values()]
    frames.clear()
    pendingFrames.forEach((callback) => callback(0))
  }
}

function mockAutoTextMeasurement(): void {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return Math.max(20, (this.textContent?.length ?? 0) * 12) + 16
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(82)
}

function deferImageDecode(): { resolve: () => Promise<void>; restore: () => void } {
  const OriginalFileReader = window.FileReader
  const OriginalImage = window.Image
  let resolveReader: (() => void) | null = null
  let resolveImage: (() => void) | null = null

  class DeferredFileReader {
    result = 'data:image/png;base64,AA=='
    error = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    readAsDataURL(): void {
      resolveReader = () => this.onload?.()
    }
  }

  class DeferredImage {
    naturalWidth = 100
    naturalHeight = 60
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    set src(_value: string) {
      resolveImage = () => this.onload?.()
    }
  }

  Object.defineProperty(window, 'FileReader', { configurable: true, value: DeferredFileReader })
  Object.defineProperty(window, 'Image', { configurable: true, value: DeferredImage })

  return {
    resolve: async () => {
      resolveReader?.()
      await Promise.resolve()
      resolveImage?.()
      await Promise.resolve()
    },
    restore: () => {
      Object.defineProperty(window, 'FileReader', { configurable: true, value: OriginalFileReader })
      Object.defineProperty(window, 'Image', { configurable: true, value: OriginalImage })
    }
  }
}

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({})
  }
})

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({ showMenu: mocks.showMenu })
}))

vi.mock('@renderer/contexts/PresentationCloseDecisionContext', () => ({
  usePresentationCloseDecision: () => mocks.requestCloseDecision
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({ isProjectionOpen: false, stopProjection: vi.fn() })
}))

vi.mock('@renderer/lib/projection-actions', () => ({
  startMediaProjection: mocks.startMediaProjection,
  stopProjectionSession: vi.fn()
}))

vi.mock('@renderer/lib/editable-presentation', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/editable-presentation')>(
    '@renderer/lib/editable-presentation'
  )
  return {
    ...actual,
    loadEditablePresentationSnapshot: mocks.loadEditablePresentationSnapshot
  }
})

vi.mock('@renderer/lib/editable-presentation-persistence', () => ({
  persistEditablePresentationRevision: mocks.persistEditablePresentationRevision,
  refreshEditablePresentationThumbnail: mocks.refreshEditablePresentationThumbnail
}))

vi.mock('@renderer/lib/local-fonts', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/local-fonts')>(
    '@renderer/lib/local-fonts'
  )
  return {
    ...actual,
    queryLocalFontFamiliesOnce: mocks.queryLocalFontFamiliesOnce,
    supportsLocalFontAccess: mocks.supportsLocalFontAccess
  }
})

vi.mock('@heroui/react/toast', () => ({
  toast: { warning: mocks.toastWarning, danger: mocks.toastDanger }
}))

function makeEditableItem(id = 'deck-1', name = 'Sunday.lpdeck'): FileItemRecord {
  return {
    id,
    parentId: 'file-root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name,
    url: `blob:${id}`,
    size: 1024,
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE
  }
}

function HeaderWorkspace(): React.JSX.Element {
  return (
    <ShortcutScopeProvider>
      <PresentationWorkspaceHeader />
      <PresentationWorkspacePage />
    </ShortcutScopeProvider>
  )
}

function HeaderWorkspaceWithSession({
  onSession
}: {
  onSession: (session: PresentationSessionRegistry) => void
}): React.JSX.Element {
  onSession(usePresentationSessionRegistry())
  return <HeaderWorkspace />
}

function GuardedWorkspace({
  onSession
}: {
  onSession: (session: PresentationSessionRegistry) => void
}): React.JSX.Element {
  onSession(usePresentationSessionRegistry())
  return (
    <>
      <PresentationNavigationGuard />
      <PresentationWorkspacePage />
    </>
  )
}

function Workspace({
  showPage,
  onSession
}: {
  showPage: boolean
  onSession: (session: PresentationSessionRegistry) => void
}): React.JSX.Element {
  onSession(usePresentationSessionRegistry())
  return showPage ? <PresentationWorkspacePage /> : <div>other route</div>
}

function renderEditableWorkspaceWithText(): void {
  const document = createBlankEditablePresentationDocument('Sunday')
  const slideId = document.slideOrder[0]
  mocks.loadEditablePresentationSnapshot.mockResolvedValue({
    document: addElementToSlide(document, slideId, createTextElement({ text: 'Font target' })),
    revision: 0
  })
  render(
    <PresentationSessionRegistryProvider>
      <PresentationWorkspacePage />
    </PresentationSessionRegistryProvider>
  )
}

async function renderWorkspaceSession(): Promise<PresentationEditorSession> {
  let registry: PresentationSessionRegistry | null = null
  render(
    <PresentationSessionRegistryProvider>
      <Workspace showPage onSession={(next) => (registry = next)} />
    </PresentationSessionRegistryProvider>
  )
  await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
  return registry!.get('deck-1')!
}

describe('PresentationWorkspacePage session integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    resizeObserverRecords = []
    globalThis.ResizeObserver = class {
      private readonly record: ResizeObserverRecord

      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, targets: new Set() }
        resizeObserverRecords.push(this.record)
      }

      observe = (target: Element): void => {
        this.record.targets.add(target)
      }

      unobserve = (target: Element): void => {
        this.record.targets.delete(target)
      }

      disconnect = (): void => {
        this.record.targets.clear()
      }
    }
    const item = makeEditableItem()
    const document = createBlankEditablePresentationDocument('Sunday')
    mocks.loadEditablePresentationSnapshot.mockReset()
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })
    mocks.persistEditablePresentationRevision.mockReset()
    mocks.persistEditablePresentationRevision.mockImplementation(async (request) => ({
      revision: request.revision,
      mirrorWarnings: []
    }))
    mocks.refreshEditablePresentationThumbnail.mockReset()
    mocks.refreshEditablePresentationThumbnail.mockResolvedValue(undefined)
    mocks.queryLocalFontFamiliesOnce.mockReset()
    mocks.queryLocalFontFamiliesOnce.mockResolvedValue([])
    mocks.supportsLocalFontAccess.mockReset()
    mocks.supportsLocalFontAccess.mockReturnValue(true)
    mocks.showMenu.mockReset()
    mocks.toastWarning.mockReset()
    mocks.toastDanger.mockReset()
    mocks.startMediaProjection.mockReset()
    mocks.startMediaProjection.mockResolvedValue({
      summary: { ready: 1, preparing: 0, unsupported: 0, missing: 0, failed: 0 },
      items: [
        { itemId: item.id, blobId: item.id, status: 'ready', reason: 'ready', support: 'native' }
      ]
    })
    mocks.requestCloseDecision.mockReset()
    mocks.requestCloseDecision.mockResolvedValue('keep-editing')
    useFileExplorerStore.setState({
      items: { [item.id]: item },
      _itemsArray: [item]
    })
    usePresentationWorkspaceStore.setState({
      documents: [],
      activeItemId: null,
      activeSlideIdByItemId: {}
    })
    usePresentationWorkspaceStore.getState().openDocument(item)
  })

  it('orders Home around supported commands without captions or geometry fields', async () => {
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const homeRibbon = await screen.findByTestId('presentation-ribbon-frame')
    const homeGroups = within(homeRibbon).getAllByRole('group')

    expect(homeGroups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Clipboard',
      'Slides',
      'Font',
      'Paragraph',
      'Insert',
      'Arrange'
    ])
    expect(within(homeRibbon).getByRole('button', { name: 'Paste' })).toBeDisabled()
    expect(within(homeRibbon).getByRole('button', { name: 'New Slide' })).toBeEnabled()
    expect(within(homeRibbon).getByRole('button', { name: 'Picture' })).toBeEnabled()
    expect(within(homeRibbon).getByRole('button', { name: 'Shapes' })).toBeEnabled()
    expect(within(homeRibbon).getByRole('button', { name: 'Text Box' })).toBeEnabled()
    expect(homeGroups.every((group) => group.querySelector('p') === null)).toBe(true)
    expect(within(homeRibbon).queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('exposes Ribbon tabs with roving selection and keyboard navigation', async () => {
    const user = userEvent.setup()
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const tablist = await screen.findByRole('tablist')
    const home = within(tablist).getByRole('tab', { name: '常用' })
    const insert = within(tablist).getByRole('tab', { name: '插入' })
    const design = within(tablist).getByRole('tab', { name: '設計' })
    const panel = screen.getByRole('tabpanel')

    expect(home).toHaveAttribute('aria-selected', 'true')
    expect(home).toHaveAttribute('tabindex', '0')
    expect(home).toHaveAttribute('aria-controls', panel.id)
    expect(home).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveAttribute('aria-labelledby', home.id)

    home.focus()
    await user.keyboard('{ArrowLeft}')
    expect(design).toHaveFocus()
    expect(design).toHaveAttribute('aria-selected', 'true')
    expect(home).toHaveAttribute('tabindex', '-1')

    await user.keyboard('{ArrowRight}')
    expect(home).toHaveFocus()
    expect(home).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    expect(design).toHaveFocus()
    expect(design).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(home).toHaveFocus()
    expect(home).toHaveAttribute('aria-selected', 'true')
    expect(insert).toHaveAttribute('aria-selected', 'false')
    expect(panel).toHaveAttribute('aria-labelledby', home.id)

    await user.click(home)
    expect(home).toHaveAttribute('aria-expanded', 'false')
    await user.click(home)
    expect(home).toHaveAttribute('aria-expanded', 'true')
  })

  it('changes Ribbon tabs with arrow keys without nudging the selected image', async () => {
    const user = userEvent.setup()
    let registry: PresentationSessionRegistry | null = null
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
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document: withImage, revision: 0 })
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )

    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const imageElement = (await screen.findAllByRole('img', { name: 'Worship image' }))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(imageElement).not.toBeNull()
    fireEvent.pointerDown(imageElement!, { clientX: 10, clientY: 10 })
    const home = screen.getByRole('tab', { name: '常用' })
    const insert = screen.getByRole('tab', { name: '插入' })
    const initialX = session.getSnapshot().renderedDocument.slides[slideId].elements[image.id].x

    home.focus()
    await user.keyboard('{ArrowRight}')

    expect(insert).toHaveFocus()
    expect(insert).toHaveAttribute('aria-selected', 'true')
    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[image.id].x).toBe(
      initialX
    )
  })

  it('skips Ribbon controls when the selected tab collapses its panel', async () => {
    const user = userEvent.setup()
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const home = await screen.findByRole('tab', { name: '常用' })
    const panel = await screen.findByRole('tabpanel')
    await user.click(home)

    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveAttribute('inert')
    await user.tab()
    expect(panel).not.toContainElement(document.activeElement as HTMLElement)
  })

  it('keeps text formatting on Home without adding a Text contextual tab', async () => {
    renderEditableWorkspaceWithText()
    const textElement = (await screen.findAllByText('Font target'))
      .at(-1)
      ?.closest('[data-slide-element]')

    expect(textElement).not.toBeNull()
    fireEvent.pointerDown(textElement!, { clientX: 10, clientY: 10 })

    await waitFor(() =>
      expect(screen.queryByRole('tab', { name: /^(Text|文字格式)$/ })).not.toBeInTheDocument()
    )
    expect(screen.getByRole('group', { name: 'Font' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Paragraph' })).toBeInTheDocument()
  })

  it('dispatches Windows and macOS editor commands through the active session', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32')
    const source = createBlankEditablePresentationDocument('Sunday')
    const slideId = source.slideOrder[0]
    const text = createTextElement({ text: 'Keyboard target' })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(source, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()

    fireEvent.keyDown(document, { code: 'KeyM', key: 'm', ctrlKey: true })
    expect(session.getSnapshot().renderedDocument.slideOrder).toHaveLength(2)

    platform.mockReturnValue('MacIntel')
    fireEvent.keyDown(document, { code: 'KeyN', key: 'N', metaKey: true, shiftKey: true })
    expect(session.getSnapshot().renderedDocument.slideOrder).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '1Keyboard target' }))
    const textFrame = (await screen.findAllByText('Keyboard target'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textFrame).not.toBeNull()
    fireEvent.click(textFrame!)

    platform.mockReturnValue('Win32')
    fireEvent.keyDown(document, { code: 'KeyB', key: 'b', ctrlKey: true })
    platform.mockReturnValue('MacIntel')
    fireEvent.keyDown(document, { code: 'KeyI', key: 'i', metaKey: true })
    fireEvent.keyDown(document, { code: 'KeyU', key: 'u', metaKey: true })

    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      bold: true,
      italic: true,
      underline: true
    })
  })

  it('duplicates only an applicable selected object in one history transaction', async () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel')
    const source = createBlankEditablePresentationDocument('Sunday')
    const slideId = source.slideOrder[0]
    const text = createTextElement({ text: 'Duplicate target' })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(source, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()
    const initialHistoryLength = session.getSnapshot().history.past.length

    fireEvent.keyDown(document, { code: 'KeyD', key: 'd', metaKey: true })
    expect(session.getSnapshot().history.past).toHaveLength(initialHistoryLength)
    expect(session.getSnapshot().renderedDocument.slides[slideId].elementOrder).toHaveLength(1)

    const textFrame = (await screen.findAllByText('Duplicate target'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textFrame).not.toBeNull()
    fireEvent.click(textFrame!)
    fireEvent.keyDown(document, { code: 'KeyD', key: 'd', metaKey: true })

    const snapshot = session.getSnapshot()
    expect(snapshot.history.past).toHaveLength(initialHistoryLength + 1)
    expect(snapshot.renderedDocument.slides[slideId].elementOrder).toHaveLength(2)
  })

  it('supports plus/equal zoom-in variants, zoom-out, and fit on both platforms', async () => {
    const platform = vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32')
    await renderWorkspaceSession()
    const viewport = await screen.findByTestId('presentation-canvas-viewport')
    resizeElement(viewport, 1050, 486)
    const zoom = screen.getByRole('slider', { name: 'Zoom' })

    fireEvent.keyDown(document, {
      code: 'Equal',
      key: '+',
      ctrlKey: true,
      shiftKey: true
    })
    expect(zoom).toHaveValue('98')
    fireEvent.keyDown(document, { code: 'Equal', key: '=', ctrlKey: true })
    expect(zoom).toHaveValue('123')
    fireEvent.keyDown(document, { code: 'Minus', key: '-', ctrlKey: true })
    expect(zoom).toHaveValue('98')

    platform.mockReturnValue('MacIntel')
    fireEvent.keyDown(document, { code: 'Equal', key: '=', metaKey: true })
    expect(zoom).toHaveValue('123')
    fireEvent.keyDown(document, { code: 'KeyO', key: 'o', metaKey: true, altKey: true })
    await waitFor(() => expect(zoom).toHaveValue('73'))
  })

  it('uses the default Windows resolver after platform-scoped shortcut tests', async () => {
    const session = await renderWorkspaceSession()

    fireEvent.keyDown(document, { code: 'KeyM', key: 'm', ctrlKey: true })

    expect(session.getSnapshot().renderedDocument.slideOrder).toHaveLength(2)
  })

  it('navigates slides and progresses Enter/Escape editor state without stealing caret keys', async () => {
    const source = createBlankEditablePresentationDocument('Sunday')
    const firstSlideId = source.slideOrder[0]
    const text = createTextElement({ text: 'Editable target' })
    const withText = addElementToSlide(source, firstSlideId, text)
    const second = insertBlankEditableSlide(withText, 1)
    const third = insertBlankEditableSlide(second.document, 2)
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: third.document,
      revision: 0
    })
    const session = await renderWorkspaceSession()

    fireEvent.keyDown(document, { code: 'PageDown', key: 'PageDown' })
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId('deck-1')).toBe(second.slideId)
    fireEvent.keyDown(document, { code: 'PageUp', key: 'PageUp' })
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId('deck-1')).toBe(firstSlideId)

    const textFrame = (await screen.findAllByText('Editable target'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textFrame).not.toBeNull()
    fireEvent.click(textFrame!)
    fireEvent.keyDown(document, { code: 'Enter', key: 'Enter' })
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')!
    expect(content).toHaveAttribute('contenteditable', 'true')
    expect(content).toHaveFocus()

    const historyLength = session.getSnapshot().history.past.length
    fireEvent.keyDown(content, { code: 'PageDown', key: 'PageDown' })
    fireEvent.keyDown(content, { code: 'KeyB', key: 'b', ctrlKey: true })
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId('deck-1')).toBe(firstSlideId)
    expect(session.getSnapshot().history.past).toHaveLength(historyLength)

    fireEvent.keyDown(content, { code: 'Escape', key: 'Escape' })
    expect(content).toHaveAttribute('contenteditable', 'false')
    expect(content).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeEnabled()
    fireEvent.keyDown(content, { code: 'KeyB', key: 'b', ctrlKey: true })
    expect(session.getSnapshot().history.past).toHaveLength(historyLength + 1)
    expect(
      session.getSnapshot().renderedDocument.slides[firstSlideId].elements[text.id]
    ).toMatchObject({ bold: true })

    fireEvent.keyDown(content, { code: 'Escape', key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled()

    const textInsert = screen.getByRole('button', { name: 'Text Box' })
    fireEvent.click(textInsert)
    expect(textInsert).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(document, { code: 'Escape', key: 'Escape' })
    expect(textInsert).toHaveAttribute('aria-pressed', 'false')
  })

  it('finalizes pending text on Escape instead of discarding its active edit transaction', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()
    const historyLength = session.getSnapshot().history.past.length
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    content.textContent = 'Keep me'
    fireEvent.input(content)
    fireEvent.keyDown(content, { key: 'Escape', code: 'Escape' })

    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      text: 'Keep me'
    })
    expect(session.getSnapshot().history.past).toHaveLength(historyLength + 1)
    act(() => flushAnimationFrame())
    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      text: 'Keep me'
    })
  })

  it('keeps composition active on Escape and exposes pending DOM text as unsafe work', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.compositionStart(content)
    content.textContent = 'Provisional'
    fireEvent.input(content)
    expect(registry!.hasUnsafeWork()).toBe(true)
    fireEvent.keyDown(content, { key: 'Escape', code: 'Escape', keyCode: 229, isComposing: true })

    expect(content).toHaveAttribute('contenteditable', 'true')
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Before' })
    fireEvent.compositionEnd(content)
    act(() => flushAnimationFrame())
    fireEvent.keyDown(content, { key: 'Escape', code: 'Escape' })

    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Provisional' })
  })

  it('reports regular pending editor input as unsafe before its animation frame', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    content.textContent = 'Pending navigation text'
    fireEvent.input(content)

    expect(registry!.hasUnsafeWork()).toBe(true)
    act(() => flushAnimationFrame())
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Pending navigation text' })
  })

  it('settles a refocused pending blur through text commit without leaving edit mode unsafe', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    vi.useFakeTimers()
    try {
      const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
      if (!content) throw new Error('presentation text box not found')
      fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
      content.textContent = 'Refocused text'
      fireEvent.input(content)
      fireEvent.blur(content)
      fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 2 })
      act(() => flushAnimationFrame())
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(
        registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
      ).toMatchObject({ text: 'Refocused text' })
      expect(registry!.get('deck-1')!.getSnapshot().draftKind).toBeNull()
      expect(registry!.hasUnsafeWork()).toBe(false)
      expect(content).toHaveAttribute('contenteditable', 'true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('blocks real navigation and browser unload until live pending text finalizes', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: (
            <PresentationSessionRegistryProvider>
              <GuardedWorkspace onSession={(next) => (registry = next)} />
            </PresentationSessionRegistryProvider>
          )
        }
      ],
      { initialEntries: ['/presentations/deck-1'] }
    )
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    content.textContent = 'Navigate safely'
    fireEvent.input(content)
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)

    await act(() => router.navigate('/files'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/files'))
    act(() => flushAnimationFrame())
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Navigate safely' })
  })

  it('keeps real navigation blocked through composition until compositionend', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: (
            <PresentationSessionRegistryProvider>
              <GuardedWorkspace onSession={(next) => (registry = next)} />
            </PresentationSessionRegistryProvider>
          )
        }
      ],
      { initialEntries: ['/presentations/deck-1'] }
    )
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.compositionStart(content)
    content.textContent = 'Composed navigation text'
    fireEvent.input(content)

    await act(() => router.navigate('/files'))
    expect(router.state.location.pathname).toBe('/presentations/deck-1')
    fireEvent.compositionEnd(content)
    act(() => flushAnimationFrame())
    await act(() => router.navigate('/files'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/files'))
  })

  it('finalizes live text before header Undo and does not reapply its queued frame', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({
      text: 'Before',
      width: 120,
      height: 40,
      autoSize: 'fixed',
      autoWidth: false
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <HeaderWorkspaceWithSession onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    act(() => content.blur())
    act(() => flushAnimationFrame())
    expect(registry!.get('deck-1')!.getSnapshot().draftKind).toBeNull()
    expect(registry!.get('deck-1')!.getSnapshot().history.past).toHaveLength(0)
    expect(registry!.hasPendingEditorWork?.('deck-1')).toBe(false)
    expect(usePresentationWorkspaceStore.getState().getActiveDocument()?.canUndo).toBe(false)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled())
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    content.textContent = 'Undo target'
    fireEvent.input(content)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toBeEnabled()
    fireEvent.click(undo)

    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Before' })
    act(() => flushAnimationFrame())
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Before' })
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Undo target' })
    fireEvent.keyDown(document, { key: 'z', code: 'KeyZ', ctrlKey: true })
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Before' })
  })

  it('blocks header Undo while text composition is active', async () => {
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <HeaderWorkspaceWithSession onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.compositionStart(content)
    content.textContent = 'Provisional'
    fireEvent.input(content)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()

    expect(content).toHaveAttribute('contenteditable', 'true')
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Before' })
  })

  it('finalizes pending DOM text before Header starts projection and blocks composition', async () => {
    const user = userEvent.setup()
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    await (
      await openFileExplorerDB()
    ).put('folder-items', useFileExplorerStore.getState().items['deck-1']!)
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <HeaderWorkspaceWithSession onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const content = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!content) throw new Error('presentation text box not found')
    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    content.textContent = 'Projected text'
    fireEvent.input(content)
    await user.click(screen.getByRole('button', { name: 'Start projection' }))

    await waitFor(() => expect(mocks.startMediaProjection).toHaveBeenCalledTimes(1))
    expect(
      registry!.get('deck-1')!.getSnapshot().history.present.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Projected text' })
    act(() => flushAnimationFrame())
    expect(
      registry!.get('deck-1')!.getSnapshot().history.present.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Projected text' })

    fireEvent.pointerDown(content, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.compositionStart(content)
    content.textContent = 'Provisional'
    fireEvent.input(content)
    await user.click(screen.getByRole('button', { name: 'Start projection' }))

    await waitFor(() =>
      expect(mocks.toastDanger).toHaveBeenCalledWith('Unable to save presentation')
    )
    expect(mocks.startMediaProjection).toHaveBeenCalledTimes(1)
    fireEvent.compositionEnd(content)
    content.textContent = 'Final composition'
    fireEvent.input(content)
    await user.click(screen.getByRole('button', { name: 'Start projection' }))
    await waitFor(() => expect(mocks.startMediaProjection).toHaveBeenCalledTimes(2))
    expect(
      registry!.get('deck-1')!.getSnapshot().history.present.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Final composition' })
  })

  it('lets Enter activate Shapes while a text frame is selected', async () => {
    const user = userEvent.setup()
    const source = createBlankEditablePresentationDocument('Sunday')
    const slideId = source.slideOrder[0]
    const text = createTextElement({ text: 'Selected target' })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(source, slideId, text),
      revision: 0
    })
    await renderWorkspaceSession()

    const textFrame = (await screen.findAllByText('Selected target'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textFrame).not.toBeNull()
    fireEvent.click(textFrame!)
    const shapes = screen.getByRole('button', { name: 'Shapes' })

    shapes.focus()
    await user.keyboard('{Enter}')

    expect(mocks.showMenu).toHaveBeenCalledOnce()
    expect(shapes).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeEnabled()
    expect(document.querySelector('.presentation-stage [data-text-content]')).toHaveAttribute(
      'contenteditable',
      'false'
    )

    const svg = shapes.querySelector('svg')
    expect(svg).not.toBeNull()
    const label = document.createElement('span')
    shapes.appendChild(label)
    for (const target of [svg!, label]) {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Enter',
        key: 'Enter'
      })
      act(() => target.dispatchEvent(event))

      expect(event.defaultPrevented).toBe(false)
      expect(document.querySelector('.presentation-stage [data-text-content]')).toHaveAttribute(
        'contenteditable',
        'false'
      )
    }
  })

  it.each(['menu', 'dialog'] as const)(
    'does not dispatch editor shortcuts from an active %s',
    async (role) => {
      const session = await renderWorkspaceSession()
      const overlay = document.createElement('div')
      overlay.setAttribute('role', role)
      const button = document.createElement('button')
      overlay.appendChild(button)
      document.body.appendChild(overlay)

      fireEvent.keyDown(button, { code: 'KeyM', key: 'm', ctrlKey: true })

      expect(session.getSnapshot().renderedDocument.slideOrder).toHaveLength(1)
      overlay.remove()
    }
  )

  it('does not dispatch an already-prevented editor shortcut', async () => {
    const session = await renderWorkspaceSession()
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyM',
      key: 'm',
      ctrlKey: true
    })
    event.preventDefault()
    document.dispatchEvent(event)

    expect(session.getSnapshot().renderedDocument.slideOrder).toHaveLength(1)
  })

  it('loads each installed font once from the font selector first gesture', async () => {
    let resolveFonts!: (families: string[]) => void
    mocks.queryLocalFontFamiliesOnce.mockReturnValue(
      new Promise((resolve) => {
        resolveFonts = resolve
      })
    )
    renderEditableWorkspaceWithText()
    fireEvent.click((await screen.findAllByRole('textbox')).at(-1)!)
    const fontSelector = screen.getByLabelText('Font family')
    const retryButton = screen.getByRole('button', { name: 'Load local fonts' })

    fireEvent.pointerDown(fontSelector)
    fireEvent.focus(fontSelector)

    expect(mocks.queryLocalFontFamiliesOnce).toHaveBeenCalledOnce()
    expect(retryButton).toBeDisabled()
    await act(async () => resolveFonts(['PMingLiU', 'MingLiU', 'DFKai-SB', 'PMingLiU', 'DFKai-SB']))

    await waitFor(() => expect(retryButton).toBeEnabled())
    expect(screen.getAllByRole('option', { name: 'PMingLiU' })).toHaveLength(1)
    expect(screen.getAllByRole('option', { name: 'MingLiU' })).toHaveLength(1)
    expect(screen.getAllByRole('option', { name: 'DFKai-SB' })).toHaveLength(1)
  })

  it('warns after font access is rejected and retries from the explicit control', async () => {
    mocks.queryLocalFontFamiliesOnce
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
      .mockResolvedValueOnce(['Songti TC'])
    renderEditableWorkspaceWithText()
    fireEvent.click((await screen.findAllByRole('textbox')).at(-1)!)

    fireEvent.focus(screen.getByLabelText('Font family'))

    await waitFor(() =>
      expect(mocks.toastWarning).toHaveBeenCalledWith(
        'Unable to load local fonts. Check the font access permission.'
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Load local fonts' }))

    expect(await screen.findByRole('option', { name: 'Songti TC' })).toBeInTheDocument()
    expect(mocks.queryLocalFontFamiliesOnce).toHaveBeenCalledTimes(2)
  })

  it('renders the same registry session after the routed view remounts', async () => {
    let registry: PresentationSessionRegistry | null = null
    const { rerender } = render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const document = session.getSnapshot().renderedDocument
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Unsaved local text' })
    act(() => session.commit(addElementToSlide(document, slideId, text)))

    expect(await screen.findAllByText('Unsaved local text')).not.toHaveLength(0)

    rerender(
      <PresentationSessionRegistryProvider>
        <Workspace showPage={false} onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    rerender(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )

    expect(await screen.findAllByText('Unsaved local text')).not.toHaveLength(0)
    expect(mocks.loadEditablePresentationSnapshot).toHaveBeenCalledTimes(1)
  })

  it('does not carry Format Background to another editable deck through the workspace header', async () => {
    const user = userEvent.setup()
    const firstItem = makeEditableItem()
    const secondItem = makeEditableItem('deck-2', 'Sermon.lpdeck')
    useFileExplorerStore.setState({
      items: { [firstItem.id]: firstItem, [secondItem.id]: secondItem },
      _itemsArray: [firstItem, secondItem]
    })
    usePresentationWorkspaceStore.getState().openDocument(secondItem)
    usePresentationWorkspaceStore.getState().setActiveDocument(firstItem.id)

    render(
      <PresentationSessionRegistryProvider>
        <HeaderWorkspace />
      </PresentationSessionRegistryProvider>
    )

    const ribbonFrame = await screen.findByTestId('presentation-ribbon-frame')
    await user.click(screen.getByRole('tab', { name: '設計' }))
    await user.click(within(ribbonFrame).getByRole('button', { name: 'Format Background' }))
    expect(window.document.querySelector('.workspace-inspector-slot')).not.toBeNull()

    await user.click(screen.getByText('Sermon.lpdeck'))
    await waitFor(() =>
      expect(usePresentationWorkspaceStore.getState().activeItemId).toBe(secondItem.id)
    )
    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()

    await user.click(screen.getByText('Sunday.lpdeck'))
    await waitFor(() =>
      expect(usePresentationWorkspaceStore.getState().activeItemId).toBe(firstItem.id)
    )
    expect(window.document.querySelector('.workspace-inspector-slot')).toBeNull()
  })

  it('stores Ribbon font sizes as canvas pixels derived from PowerPoint points', async () => {
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const document = session.getSnapshot().renderedDocument
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Scale me', fontSize: 88 })

    act(() => session.commit(addElementToSlide(document, slideId, text)))
    const textElement = (await screen.findAllByText('Scale me'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textElement).not.toBeNull()
    fireEvent.pointerDown(textElement!, { clientX: 10, clientY: 10 })
    const fontSizeSelect = screen
      .getAllByRole('combobox')
      .find((select) => select.querySelector('option[value="72"]'))
    expect(fontSizeSelect).toBeDefined()
    expect(
      Array.from(fontSizeSelect!.querySelectorAll('option'), (option) => Number(option.value))
    ).toEqual([
      8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96
    ])

    fireEvent.change(fontSizeSelect!, { target: { value: '72' } })

    await waitFor(() => {
      const updated = session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
      expect(updated.type === 'text' ? updated.fontSize : null).toBe(144)
    })
  })

  it.each([1920, 1280])(
    'inserts 18 point text with line-height and vertical inset at %i px document width',
    async (documentWidth) => {
      const sourceDocument = createBlankEditablePresentationDocument('Sunday')
      sourceDocument.width = documentWidth
      sourceDocument.height = (documentWidth * 9) / 16
      mocks.loadEditablePresentationSnapshot.mockResolvedValue({
        document: sourceDocument,
        revision: 0
      })
      let registry: PresentationSessionRegistry | null = null
      render(
        <PresentationSessionRegistryProvider>
          <Workspace showPage onSession={(next) => (registry = next)} />
        </PresentationSessionRegistryProvider>
      )
      await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())

      const surface = window.document.querySelector<HTMLElement>(
        '.presentation-stage [data-slide-surface]'
      )
      expect(surface).not.toBeNull()
      vi.spyOn(surface!, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: documentWidth / 2,
        bottom: sourceDocument.height / 2,
        width: documentWidth / 2,
        height: sourceDocument.height / 2,
        toJSON: () => undefined
      })

      fireEvent.doubleClick(surface!, { clientX: 100, clientY: 100 })

      await waitFor(() => {
        const document = registry!.get('deck-1')!.getSnapshot().renderedDocument
        const slide = document.slides[document.slideOrder[0]]
        expect(slide.elementOrder).toHaveLength(1)
        const element = slide.elements[slide.elementOrder[0]]
        expect(element.type).toBe('text')
        if (element.type !== 'text') return
        expect((element.fontSize * 960) / documentWidth).toBe(18)
        expect(element.height).toBe(
          Math.max(32, Math.ceil(element.fontSize * element.lineHeight) + 8)
        )
        expect(element.autoSize).toBe('content')
        expect(element.autoWidth).toBe(true)
      })

      fireEvent.click(screen.getByRole('tab', { name: '插入' }))
      fireEvent.click(screen.getByRole('button', { name: 'Text' }))
      fireEvent.pointerDown(surface!, { clientX: 100, clientY: 100, pointerId: 1 })
      fireEvent.pointerUp(surface!, { clientX: 140, clientY: 120, pointerId: 1 })

      await waitFor(() => {
        const slide = registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[
          sourceDocument.slideOrder[0]
        ]
        const dragged = slide.elements[slide.elementOrder[1]]
        expect(dragged.type).toBe('text')
        if (dragged.type !== 'text') return
        expect(dragged.height).toBe(
          Math.max(40, Math.ceil(dragged.fontSize * dragged.lineHeight) + 8)
        )
        expect(dragged.autoSize).toBe('content')
        expect(dragged.autoWidth).toBe(false)
      })

      const rightHandle = screen.getByLabelText('Resize text box right')
      fireEvent.pointerDown(rightHandle, { clientX: 0, clientY: 0, pointerId: 2 })
      fireEvent.pointerMove(rightHandle, { clientX: 12, clientY: 0, pointerId: 2 })
      fireEvent.pointerUp(rightHandle, { clientX: 12, clientY: 0, pointerId: 2 })

      await waitFor(() => {
        const slide = registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[
          sourceDocument.slideOrder[0]
        ]
        const resized = slide.elements[slide.elementOrder[1]]
        expect(resized.type === 'text' ? resized.width : null).toBe(104)
        expect(resized.type === 'text' ? resized.autoSize : null).toBe('content')
      })

      act(() => registry!.get('deck-1')!.undo())
      const afterUndo = registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[
        sourceDocument.slideOrder[0]
      ].elements[
        registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[sourceDocument.slideOrder[0]]
          .elementOrder[1]
      ]
      expect(afterUndo.type === 'text' ? afterUndo.width : null).toBe(80)
      expect(afterUndo.type === 'text' ? afterUndo.autoSize : null).toBe('content')
    }
  )

  it('does not let a pending text blur create history after a resize commits', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({
      text: 'Original text',
      width: 80,
      height: 40,
      autoSize: 'content',
      autoWidth: false
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())

    const textBox = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Pending blur text'
    fireEvent.input(textBox)
    const rightHandle = await screen.findByLabelText('Resize text box right')
    rightHandle.focus()
    fireEvent.blur(textBox)

    fireEvent.pointerDown(rightHandle, { clientX: 0, clientY: 0, pointerId: 2 })
    fireEvent.pointerMove(rightHandle, { clientX: 24, clientY: 0, pointerId: 2 })
    fireEvent.pointerUp(rightHandle, { clientX: 24, clientY: 0, pointerId: 2 })

    act(() => flushAnimationFrame())

    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Pending blur text', width: 104 })
    act(() => registry!.get('deck-1')!.undo())
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Pending blur text', width: 80 })
  })

  it('resizes from finalized auto-width text geometry and undoes only the resize', async () => {
    mockAutoTextMeasurement()
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({
      text: 'Original',
      width: 80,
      height: 30,
      autoSize: 'content',
      autoWidth: true
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())

    const textBox = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Final title'
    fireEvent.input(textBox)
    const rightHandle = await screen.findByLabelText('Resize text box right')
    rightHandle.focus()
    fireEvent.blur(textBox)

    fireEvent.pointerDown(rightHandle, { clientX: 0, clientY: 0, pointerId: 2 })
    fireEvent.pointerMove(rightHandle, { clientX: 24, clientY: 0, pointerId: 2 })
    fireEvent.pointerUp(rightHandle, { clientX: 24, clientY: 0, pointerId: 2 })
    act(() => flushAnimationFrame())

    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Final title', width: 172, height: 82 })
    act(() => registry!.get('deck-1')!.undo())
    expect(
      registry!.get('deck-1')!.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
    ).toMatchObject({ text: 'Final title', width: 148, height: 82 })
  })

  it('does not create a text history entry when editing finishes unchanged before resize', async () => {
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Unchanged', width: 80, height: 40, autoWidth: false })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()
    const initialHistoryLength = session.getSnapshot().history.past.length
    const textBox = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    const rightHandle = await screen.findByLabelText('Resize text box right')
    fireEvent.pointerDown(rightHandle, { clientX: 0, clientY: 0, pointerId: 2 })
    fireEvent.pointerMove(rightHandle, { clientX: 24, clientY: 0, pointerId: 2 })
    fireEvent.pointerUp(rightHandle, { clientX: 24, clientY: 0, pointerId: 2 })

    expect(session.getSnapshot().history.past).toHaveLength(initialHistoryLength + 1)
    act(() => session.undo())
    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      text: 'Unchanged',
      width: 80
    })
  })

  it('commits one history entry for each keyboard resize action', async () => {
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({
      text: 'Keyboard frame',
      x: 100,
      y: 80,
      width: 220,
      height: 40,
      autoSize: 'fixed',
      autoWidth: false
    })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()
    const initialHistoryLength = session.getSnapshot().history.past.length
    const textFrame = (await screen.findAllByText('Keyboard frame'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textFrame).not.toBeNull()
    fireEvent.click(textFrame!)

    const firstHandle = screen.getByLabelText('Resize text box right')
    const firstResize = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    })
    fireEvent(firstHandle, firstResize)

    expect(firstResize.defaultPrevented).toBe(true)
    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      x: 100,
      width: 221
    })
    expect(session.getSnapshot().history.past).toHaveLength(initialHistoryLength + 1)

    const secondHandle = screen.getByLabelText('Resize text box right')
    fireEvent.keyDown(secondHandle, { key: 'ArrowRight', shiftKey: true })
    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      x: 100,
      width: 231
    })
    expect(session.getSnapshot().history.past).toHaveLength(initialHistoryLength + 2)
  })

  it('does not select a generated shape while composition blocks the mutation', async () => {
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Composing', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()
    const textBox = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.compositionStart(textBox)
    expect(screen.getByLabelText('Resize text box right')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '插入' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }))

    expect(session.getSnapshot().renderedDocument.slides[slideId].elementOrder).toEqual([text.id])
    expect(screen.getByLabelText('Resize text box right')).toBeInTheDocument()
  })

  it('rebases pending text before New Slide and keyboard nudge mutations', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', x: 20, y: 20, width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    const session = await renderWorkspaceSession()
    const textBox = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Before New Slide'
    fireEvent.input(textBox)
    const newSlide = screen.getByRole('button', { name: 'New Slide' })
    newSlide.focus()
    fireEvent.blur(textBox)
    fireEvent.click(newSlide)
    act(() => flushAnimationFrame())

    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      text: 'Before New Slide'
    })
    expect(session.getSnapshot().renderedDocument.slideOrder).toHaveLength(2)

    await act(async () => {
      usePresentationWorkspaceStore.getState().setActiveSlideId('deck-1', slideId)
    })
    const returnedTextBox = document.querySelector<HTMLElement>(
      '.presentation-stage [data-text-content]'
    )
    if (!returnedTextBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(returnedTextBox, { clientX: 40, clientY: 20, pointerId: 2 })
    returnedTextBox.textContent = 'Before Nudge'
    fireEvent.input(returnedTextBox)
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    act(() => flushAnimationFrame())

    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      text: 'Before Nudge',
      x: 21
    })
  })

  it.each([
    ['activation', 'activate', true],
    ['close save', 'close', true],
    ['close discard', 'discard', false],
    ['flush all', 'flushAll', true]
  ] as const)('finalizes live pending text before %s', async (_label, action, persists) => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: addElementToSlide(sourceDocument, slideId, text),
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const textBox = document.querySelector<HTMLElement>('.presentation-stage [data-text-content]')
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Final before boundary'
    fireEvent.input(textBox)

    if (action === 'activate') {
      const secondItem = makeEditableItem('deck-2', 'Second.lpdeck')
      useFileExplorerStore.setState((state) => ({
        items: { ...state.items, [secondItem.id]: secondItem },
        _itemsArray: [...state._itemsArray, secondItem]
      }))
      await act(async () => {
        await registry!.open(secondItem)
        await registry!.activate(secondItem.id)
      })
    } else if (action === 'flushAll') {
      await act(async () => {
        await registry!.flushAll()
      })
    } else {
      await act(async () => {
        await registry!.close('deck-1', action === 'discard' ? 'discard' : undefined)
      })
    }
    const persistedBeforeFrame = mocks.persistEditablePresentationRevision.mock.calls.length
    act(() => flushAnimationFrame())

    if (persists) {
      expect(mocks.persistEditablePresentationRevision).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'deck-1',
          document: expect.objectContaining({
            slides: expect.objectContaining({
              [slideId]: expect.objectContaining({
                elements: expect.objectContaining({
                  [text.id]: expect.objectContaining({ text: 'Final before boundary' })
                })
              })
            })
          })
        })
      )
    } else {
      expect(mocks.persistEditablePresentationRevision).not.toHaveBeenCalled()
    }
    if (action === 'flushAll') {
      expect(mocks.persistEditablePresentationRevision).toHaveBeenCalledTimes(persistedBeforeFrame)
    }
  })

  it('drops a deferred image decode after its document session closes', async () => {
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const decode = deferImageDecode()
    try {
      const input = globalThis.document.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input) throw new Error('image file input not found')
      fireEvent.change(input, {
        target: { files: [new File(['image'], 'late.png', { type: 'image/png' })] }
      })

      await act(async () => {
        await registry!.close('deck-1')
      })
      await act(async () => {
        await decode.resolve()
      })

      expect(registry!.get('deck-1')).toBeUndefined()
      expect(mocks.persistEditablePresentationRevision).not.toHaveBeenCalled()
    } finally {
      decode.restore()
    }
  })

  it('drops a deferred image decode when its target slide was deleted', async () => {
    const initialDocument = createBlankEditablePresentationDocument('Sunday')
    const { document: sourceDocument } = insertBlankEditableSlide(initialDocument, 1)
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({
      document: sourceDocument,
      revision: 0
    })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry?.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const targetSlideId = session.getSnapshot().renderedDocument.slideOrder[0]
    const decode = deferImageDecode()
    try {
      const input = globalThis.document.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input) throw new Error('image file input not found')
      fireEvent.change(input, {
        target: { files: [new File(['image'], 'late.png', { type: 'image/png' })] }
      })
      act(() => {
        session.commit(
          removeEditableSlides(session.getSnapshot().renderedDocument, [targetSlideId])
        )
      })
      mocks.persistEditablePresentationRevision.mockClear()

      await act(async () => {
        await decode.resolve()
      })

      expect(session.getSnapshot().renderedDocument.slides[targetSlideId]).toBeUndefined()
      expect(session.getSnapshot().renderedDocument.assets).toEqual({})
      expect(mocks.persistEditablePresentationRevision).not.toHaveBeenCalled()
    } finally {
      decode.restore()
    }
  })

  it('finalizes pending text before direct slide switching and deletes without a later frame write', async () => {
    const flushAnimationFrame = mockAnimationFrame()
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const slideId = sourceDocument.slideOrder[0]
    const text = createTextElement({ text: 'Before', width: 120, height: 40 })
    const withText = addElementToSlide(sourceDocument, slideId, text)
    const { document, slideId: secondSlideId } = insertBlankEditableSlide(withText, 1)
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })
    const session = await renderWorkspaceSession()
    const textBox = globalThis.document.querySelector<HTMLElement>(
      '.presentation-stage [data-text-content]'
    )
    if (!textBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Before switch'
    fireEvent.input(textBox)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    act(() => flushAnimationFrame())

    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toMatchObject({
      text: 'Before switch'
    })
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId('deck-1')).toBe(secondSlideId)

    fireEvent.click(screen.getByRole('button', { name: '1Before switch' }))
    const returnedTextBox = globalThis.document.querySelector<HTMLElement>(
      '.presentation-stage [data-text-content]'
    )
    if (!returnedTextBox) throw new Error('presentation text box not found')
    fireEvent.pointerDown(returnedTextBox, { clientX: 40, clientY: 20, pointerId: 2 })
    returnedTextBox.textContent = 'Delete me'
    fireEvent.input(returnedTextBox)
    fireEvent.keyDown(globalThis.document, { key: 'Delete' })
    act(() => flushAnimationFrame())

    expect(session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]).toBeUndefined()
  })

  it('does not expose dimensions-only Slide Size controls', async () => {
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )
    await screen.findByTestId('presentation-ribbon-frame')

    fireEvent.click(screen.getByRole('tab', { name: /Design|設計/ }))

    expect(screen.queryByText(/Slide Size|投影片大小/)).not.toBeInTheDocument()
  })

  it('starts in Fit mode and recalculates when Notes changes the viewport height', async () => {
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const viewport = await screen.findByTestId('presentation-canvas-viewport')
    resizeElement(viewport, 1050, 486)

    expect(screen.getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('73')

    const notesToggle = screen.getByRole('button', { name: 'Toggle Notes' })
    expect(notesToggle).toHaveAttribute('aria-controls', 'presentation-notes-region')
    expect(notesToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(notesToggle)
    resizeElement(viewport, 1050, 400)

    const notesRegion = screen.getByRole('region', { name: 'Notes' })
    expect(notesRegion).toHaveAttribute('id', 'presentation-notes-region')
    expect(notesToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('58')
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeVisible()

    fireEvent.click(notesToggle)
    expect(notesToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('keeps committed Notes in session history across Undo and Redo', async () => {
    const sourceDocument = createBlankEditablePresentationDocument('Sunday')
    const { document, slideId: secondSlideId } = insertBlankEditableSlide(sourceDocument, 1)
    mocks.loadEditablePresentationSnapshot.mockResolvedValue({ document, revision: 0 })
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )

    await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), {
      target: { value: 'Remember the closing prayer' }
    })
    fireEvent.click(screen.getByRole('button', { name: '2' }))

    const session = registry!.get('deck-1')!
    const firstSlideId = document.slideOrder[0]
    expect(session.getSnapshot().renderedDocument.slides[firstSlideId].notes).toBe(
      'Remember the closing prayer'
    )
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId('deck-1')).toBe(secondSlideId)

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    act(() => session.undo())
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('')
    act(() => session.redo())
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue(
      'Remember the closing prayer'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    const historyLength = session.getSnapshot().history.past.length
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    expect(session.getSnapshot().history.past).toHaveLength(historyLength)
  })

  it('cancels a reverted Notes draft before route unmount without undo or save work', async () => {
    let registry: PresentationSessionRegistry | null = null
    const { rerender } = render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const initialHistoryLength = session.getSnapshot().history.past.length
    const initialScheduledRevision = session.getSnapshot().save.scheduledRevision

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    const notes = screen.getByRole('textbox', { name: 'Notes' })
    fireEvent.change(notes, { target: { value: 'Temporary note' } })
    expect(session.getSnapshot().draftKind).toBe('notes')
    fireEvent.change(notes, { target: { value: '' } })

    expect(session.getSnapshot().draftKind).toBeNull()
    rerender(
      <PresentationSessionRegistryProvider>
        <Workspace showPage={false} onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    expect(session.getSnapshot().history.past).toHaveLength(initialHistoryLength)
    expect(session.getSnapshot().save.scheduledRevision).toBe(initialScheduledRevision)
    expect(mocks.persistEditablePresentationRevision).not.toHaveBeenCalled()
  })

  it('flushes a focused Notes draft before registry activation and close', async () => {
    let registry: PresentationSessionRegistry | null = null
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const firstSlideId = session.getSnapshot().renderedDocument.slideOrder[0]
    const secondItem = makeEditableItem('deck-2', 'Sermon.lpdeck')
    useFileExplorerStore.setState((state) => ({
      items: { ...state.items, [secondItem.id]: secondItem },
      _itemsArray: [...state._itemsArray, secondItem]
    }))
    await act(async () => {
      await registry!.open(secondItem)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), {
      target: { value: 'Updated before activation' }
    })
    expect(session.getSnapshot().draftKind).toBe('notes')
    expect(registry!.hasUnsafeWork()).toBe(true)
    await act(async () => {
      await registry!.activate(secondItem.id)
    })

    expect(mocks.persistEditablePresentationRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'deck-1',
        document: expect.objectContaining({
          slides: expect.objectContaining({
            [firstSlideId]: expect.objectContaining({ notes: 'Updated before activation' })
          })
        })
      })
    )

    await act(async () => {
      await registry!.activate('deck-1')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), {
      target: { value: 'Updated before close' }
    })
    await act(async () => {
      await registry!.close('deck-1')
    })
    expect(mocks.persistEditablePresentationRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'deck-1',
        document: expect.objectContaining({
          slides: expect.objectContaining({
            [firstSlideId]: expect.objectContaining({ notes: 'Updated before close' })
          })
        })
      })
    )
  })

  it('flushes a focused Notes draft through the Electron app-close bridge', async () => {
    let registry: PresentationSessionRegistry | null = null
    let closeRequested: (() => void) | null = null
    const confirmClose = vi.fn().mockResolvedValue({ closing: true })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        app: {
          onCloseRequested: vi.fn((listener: () => void) => {
            closeRequested = listener
            return () => undefined
          }),
          confirmClose
        }
      } as unknown as Window['api']
    })
    render(
      <PresentationSessionRegistryProvider>
        <PresentationElectronCloseBridge />
        <Workspace showPage onSession={(next) => (registry = next)} />
      </PresentationSessionRegistryProvider>
    )
    await waitFor(() => expect(registry!.get('deck-1')).toBeDefined())
    const session = registry!.get('deck-1')!
    const firstSlideId = session.getSnapshot().renderedDocument.slideOrder[0]
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), {
      target: { value: 'Updated before app close' }
    })

    act(() => closeRequested?.())

    await waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(1))
    expect(mocks.persistEditablePresentationRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'deck-1',
        document: expect.objectContaining({
          slides: expect.objectContaining({
            [firstSlideId]: expect.objectContaining({ notes: 'Updated before app close' })
          })
        })
      })
    )
  })

  it('leaves Windows Meta-wheel untouched while Windows Ctrl-wheel zooms', async () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32')
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const viewport = await screen.findByTestId('presentation-canvas-viewport')
    resizeElement(viewport, 1050, 486)
    const zoom = screen.getByRole('slider', { name: 'Zoom' })
    const fit = screen.getByRole('button', { name: 'Fit' })

    const metaWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
      deltaY: -100
    })
    fireEvent(viewport, metaWheel)
    expect(metaWheel.defaultPrevented).toBe(false)
    expect(zoom).toHaveValue('73')
    expect(fit).toHaveAttribute('aria-pressed', 'true')

    const ctrlWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -100
    })
    fireEvent(viewport, ctrlWheel)
    expect(ctrlWheel.defaultPrevented).toBe(true)
    expect(zoom).toHaveValue('78')
    expect(fit).toHaveAttribute('aria-pressed', 'false')
  })

  it('anchors macOS Ctrl and Meta wheel zoom while leaving ordinary wheel scrolling alone', async () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel')
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const viewport = await screen.findByTestId('presentation-canvas-viewport')
    resizeElement(viewport, 1050, 486)
    Object.defineProperties(viewport, {
      scrollLeft: { value: 200, writable: true },
      scrollTop: { value: 100, writable: true }
    })
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1050,
      bottom: 486,
      width: 1050,
      height: 486,
      toJSON: () => undefined
    })

    const ordinaryWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
    fireEvent(viewport, ordinaryWheel)
    expect(ordinaryWheel.defaultPrevented).toBe(false)
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('73')

    const ctrlWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 200,
      ctrlKey: true,
      deltaY: -100
    })
    fireEvent(viewport, ctrlWheel)
    expect(ctrlWheel.defaultPrevented).toBe(true)
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('78')
    expect(viewport.scrollLeft).toBeCloseTo(220.55, 1)
    expect(viewport.scrollTop).toBeCloseTo(113.7, 1)

    const metaWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 200,
      metaKey: true,
      deltaY: -100
    })
    fireEvent(viewport, metaWheel)
    expect(metaWheel.defaultPrevented).toBe(true)
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('83')
  })

  it('keeps the editable stage and Ribbon inside the shared responsive workspace shell', async () => {
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )

    const ribbon = await screen.findByTestId('presentation-ribbon-frame')
    const group = window.document.querySelector('.workspace-panel-group')
    expect(group).not.toBeNull()
    expect(group!.querySelector('.workspace-navigator-slot [data-slide-sidebar]')).not.toBeNull()
    const stageSlot = group!.querySelector('.workspace-stage-slot')
    expect(stageSlot).toHaveClass('flex')
    expect(stageSlot?.querySelector('.presentation-stage')).toHaveClass('min-h-0', 'flex-1')
    expect(ribbon.querySelector('[data-ribbon-surface]')).toHaveClass(
      'overflow-x-auto',
      'overflow-y-hidden'
    )
  })
})
