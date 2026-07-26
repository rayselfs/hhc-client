import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationPreview from '../PresentationPreview'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createImageElement,
  createTextElement
} from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '@renderer/lib/presentation-media'
import type { PresentationEditorSession } from '@renderer/lib/presentation-editor-session'
import type { FileItemRecord } from '@shared/types/folder'

const { mockLoadEditablePresentation, mockRegistryGet, mockSetTypeState } = vi.hoisted(() => ({
  mockLoadEditablePresentation: vi.fn(),
  mockRegistryGet: vi.fn(),
  mockSetTypeState: vi.fn()
}))

vi.mock('@renderer/lib/editable-presentation', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/editable-presentation')>(
    '@renderer/lib/editable-presentation'
  )
  return { ...actual, loadEditablePresentation: mockLoadEditablePresentation }
})

vi.mock('@renderer/contexts/PresentationSessionRegistryContext', () => ({
  usePresentationSessionRegistry: () => ({ get: mockRegistryGet })
}))

const storeState = {
  typeStates: { presentation: { slideIndex: 0 } },
  setTypeState: mockSetTypeState
}

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    vi.fn((selector: (state: typeof storeState) => unknown) => selector(storeState)),
    { getState: () => storeState }
  )
}))

function makeItem(): FileItemRecord {
  return {
    id: 'editable-deck',
    parentId: 'root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'Editable deck.lpdeck',
    url: 'blob:editable-deck',
    size: 1,
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE
  }
}

describe('PresentationPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegistryGet.mockReturnValue(undefined)
    storeState.typeStates.presentation = { slideIndex: 0 }
  })

  it('renders editable slide text and image elements', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: '主愛永不止息', x: 10, y: 20, width: 300 })
    const asset = {
      id: 'asset-1',
      name: 'photo.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAA='
    }
    const image = createImageElement({
      assetId: asset.id,
      slideWidth: document.width,
      slideHeight: document.height,
      sourceWidth: 800,
      sourceHeight: 400
    })
    mockLoadEditablePresentation.mockResolvedValue(
      addElementToSlide(
        addElementToSlide({ ...document, assets: { [asset.id]: asset } }, slideId, text),
        slideId,
        image
      )
    )

    render(<PresentationPreview item={makeItem()} />)

    expect(await screen.findByText('主愛永不止息')).toBeInTheDocument()
    expect(screen.getByAltText('photo.png')).toHaveAttribute('src', asset.dataUrl)
    await waitFor(() => {
      expect(mockSetTypeState).toHaveBeenCalledWith('presentation', {
        slideIndex: 0,
        slideCount: 1
      })
    })
  })

  it('renders an open session revision without loading its durable fallback', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Latest session text' })
    const latestDocument = addElementToSlide(document, slideId, text)
    const snapshot = {
      history: { past: [], present: latestDocument, future: [] },
      save: {
        status: 'saved' as const,
        scheduledRevision: 1,
        persistedRevision: 1,
        error: null,
        mirrorWarnings: []
      },
      draftKind: null,
      renderedDocument: latestDocument
    }
    const session = {
      subscribe: vi.fn(() => () => undefined),
      getSnapshot: vi.fn(() => snapshot)
    } as unknown as PresentationEditorSession
    mockRegistryGet.mockReturnValue(session)

    render(<PresentationPreview item={makeItem()} />)

    expect(await screen.findByText('Latest session text')).toBeInTheDocument()
    expect(mockLoadEditablePresentation).not.toHaveBeenCalled()
  })
})
