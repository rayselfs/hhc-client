import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationWorkspacePage from '../PresentationWorkspacePage'
import PresentationWorkspaceHeader from '@renderer/components/Control/Header/PresentationWorkspaceHeader'
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
  insertBlankEditableSlide
} from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '@renderer/lib/presentation-media'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  loadEditablePresentationSnapshot: vi.fn(),
  persistEditablePresentationRevision: vi.fn(),
  refreshEditablePresentationThumbnail: vi.fn(),
  queryLocalFontFamiliesOnce: vi.fn(),
  supportsLocalFontAccess: vi.fn(),
  showMenu: vi.fn(),
  toastWarning: vi.fn()
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
  usePresentationCloseDecision: () => vi.fn()
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({ isProjectionOpen: false, stopProjection: vi.fn() })
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
  toast: { warning: mocks.toastWarning }
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
    'inserts 18 point text with a full line-height frame at %i px document width',
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
        expect(element.height).toBeGreaterThanOrEqual(
          Math.ceil(element.fontSize * element.lineHeight)
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

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Notes' }))
    resizeElement(viewport, 1050, 400)

    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('58')
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeVisible()
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

  it('anchors Ctrl and macOS Meta wheel zoom while leaving ordinary wheel scrolling alone', async () => {
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
