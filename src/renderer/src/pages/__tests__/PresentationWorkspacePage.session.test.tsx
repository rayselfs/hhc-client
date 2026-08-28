import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationWorkspacePage from '../PresentationWorkspacePage'
import PresentationWorkspaceHeader from '@renderer/components/Control/Header/PresentationWorkspaceHeader'
import {
  PresentationSessionRegistryProvider,
  usePresentationSessionRegistry,
  type PresentationSessionRegistry
} from '@renderer/contexts/PresentationSessionRegistryContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createTextElement
} from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '@renderer/lib/presentation-media'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

const mocks = vi.hoisted(() => ({
  loadEditablePresentationSnapshot: vi.fn(),
  persistEditablePresentationRevision: vi.fn(),
  refreshEditablePresentationThumbnail: vi.fn()
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
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({})
  }
})

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({ showMenu: vi.fn() })
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

describe('PresentationWorkspacePage session integration', () => {
  beforeEach(() => {
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
    await user.click(screen.getByRole('button', { name: '設計' }))
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

      fireEvent.click(screen.getByRole('button', { name: '插入' }))
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

  it('keeps content-height text content-height when the inspector changes width', async () => {
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
    const text = createTextElement({
      text: 'Content height',
      width: 220,
      height: 40,
      autoSize: 'content',
      autoWidth: false
    })
    act(() => session.commit(addElementToSlide(document, slideId, text)))

    const textElement = (await screen.findAllByText('Content height'))
      .at(-1)
      ?.closest('[data-slide-element]')
    expect(textElement).not.toBeNull()
    fireEvent.pointerDown(textElement!, { clientX: 10, clientY: 10 })
    fireEvent.change(screen.getByLabelText('width'), { target: { value: '280' } })

    await waitFor(() => {
      const updated = session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
      expect(updated.type === 'text' ? updated.width : null).toBe(280)
      expect(updated.type === 'text' ? updated.autoSize : null).toBe('content')
      expect(updated.type === 'text' ? updated.autoWidth : null).toBe(false)
    })
  })

  it('does not expose dimensions-only Slide Size controls', async () => {
    render(
      <PresentationSessionRegistryProvider>
        <Workspace showPage onSession={() => undefined} />
      </PresentationSessionRegistryProvider>
    )
    await screen.findByTestId('presentation-ribbon-frame')

    fireEvent.click(screen.getByRole('button', { name: /Design|設計/ }))

    expect(screen.queryByText(/Slide Size|投影片大小/)).not.toBeInTheDocument()
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
