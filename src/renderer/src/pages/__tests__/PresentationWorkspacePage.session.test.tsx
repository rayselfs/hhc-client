import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationWorkspacePage from '../PresentationWorkspacePage'
import {
  PresentationSessionRegistryProvider,
  usePresentationSessionRegistry,
  type PresentationSessionRegistry
} from '@renderer/contexts/PresentationSessionRegistryContext'
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

function makeEditableItem(): FileItemRecord {
  return {
    id: 'deck-1',
    parentId: 'file-root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'Sunday.lpdeck',
    url: 'blob:deck-1',
    size: 1024,
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE
  }
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

    fireEvent.change(fontSizeSelect!, { target: { value: '72' } })

    await waitFor(() => {
      const updated = session.getSnapshot().renderedDocument.slides[slideId].elements[text.id]
      expect(updated.type === 'text' ? updated.fontSize : null).toBe(144)
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
})
