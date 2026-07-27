import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlankEditablePresentationDocument } from '@renderer/lib/editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '@renderer/lib/presentation-media'
import type { PresentationEditorSession } from '@renderer/lib/presentation-editor-session'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

const registryMocks = vi.hoisted(() => ({
  get: vi.fn()
}))
const mockProject = vi.fn()
const mockStartProjection = vi.fn(() => Promise.resolve())
const mockStopProjection = vi.fn(() => Promise.resolve())
const projectionState = { activeOwner: 'media' as 'media' | 'timer' | 'bible' }

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    project: mockProject,
    startProjection: mockStartProjection,
    stopProjection: mockStopProjection,
    activeOwner: projectionState.activeOwner
  })
}))

vi.mock('@renderer/contexts/PresentationSessionRegistryContext', () => ({
  usePresentationSessionRegistry: () => registryMocks
}))

import { useMediaProjectionSync } from '../media-projection-sync'

function renderSync(): void {
  renderHook(() => useMediaProjectionSync())
}

function makeFile(id: string, name: string, mimeType = 'image/png', blobId = id): FileItemRecord {
  return {
    id,
    name,
    mimeType,
    type: 'file',
    sortIndex: 0,
    parentId: 'root',
    size: 1,
    url: `blob:${blobId}`,
    createdAt: Date.now(),
    expiresAt: null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  projectionState.activeOwner = 'media'
  registryMocks.get.mockReturnValue(undefined)
  usePresentationWorkspaceStore.setState({ activeSlideIdByItemId: {} })
  useMediaProjectionStore.setState({
    playlist: [makeFile('a', 'a.png'), makeFile('b', 'b.png')],
    currentIndex: 0,
    isPresenting: true,
    isEnded: false,
    lastReadinessReport: null,
    showGrid: false,
    snapshot: null,
    typeStates: { pdf: { viewMode: 'slide' } },
    zoomLevel: 1,
    pan: { x: 0, y: 0 }
  })
})

describe('media projection sync', () => {
  it('does not send file:show for notes-only updates', () => {
    renderSync()
    mockProject.mockClear()

    act(() => {
      useMediaProjectionStore.getState().updateNotes('b', 'new notes')
    })

    expect(mockProject).not.toHaveBeenCalledWith('file:show', expect.anything())
  })

  it('sends file:show when jumpTo changes currentIndex', () => {
    renderSync()
    mockProject.mockClear()

    act(() => {
      useMediaProjectionStore.getState().jumpTo(1)
    })

    expect(mockProject).toHaveBeenCalledWith(
      'file:show',
      expect.objectContaining({ currentIndex: 1, itemId: 'b', blobId: 'b' }),
      { bringToFront: true }
    )
  })

  it('sends separate item and blob identities for copied media', () => {
    useMediaProjectionStore.setState({
      playlist: [makeFile('copy-id', 'copy.png', 'image/png', 'original-id')],
      currentIndex: 0,
      isPresenting: true
    })

    renderSync()

    expect(mockStartProjection).toHaveBeenCalledWith(
      'media',
      [['file:show', expect.objectContaining({ itemId: 'copy-id', blobId: 'original-id' })]],
      { bringToFront: false }
    )
  })

  it('projects embedded VLC video through the desktop engine', async () => {
    useMediaProjectionStore.setState({
      playlist: [makeFile('vlc-item', 'vlc.mkv', 'video/x-matroska', 'source-blob')],
      currentIndex: 0,
      isPresenting: true,
      snapshot: {
        id: 'snapshot',
        createdAt: 1,
        entries: [
          {
            index: 0,
            itemId: 'vlc-item',
            blobId: 'source-blob',
            name: 'vlc.mkv',
            mimeType: 'video/x-matroska',
            sourceUrl: 'blob:source-blob',
            playbackMode: 'vlc-embedded',
            seekable: true,
            durationMs: 15000
          }
        ]
      }
    })

    renderSync()

    expect(mockStartProjection).toHaveBeenCalledWith(
      'media',
      [
        [
          'file:show',
          expect.objectContaining({
            itemId: 'vlc-item',
            blobId: 'source-blob',
            playbackMode: 'vlc-embedded',
            seekable: true,
            durationMs: 15000
          })
        ]
      ],
      { bringToFront: false }
    )
  })

  it('sends file:show when a PPTX slide changes', () => {
    useMediaProjectionStore.setState({
      playlist: [
        makeFile(
          'deck',
          'deck.pptx',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
      ],
      currentIndex: 0,
      isPresenting: true,
      typeStates: { pdf: { viewMode: 'slide' }, presentation: { slideIndex: 0, slideCount: 5 } }
    })
    renderSync()
    mockProject.mockClear()

    act(() => {
      useMediaProjectionStore.getState().setTypeState('presentation', {
        slideIndex: 1,
        slideCount: 5
      })
    })

    expect(mockProject).toHaveBeenCalledWith(
      'file:show',
      expect.objectContaining({
        itemId: 'deck',
        presentation: { slideIndex: 1, slideCount: 5 }
      }),
      { bringToFront: true }
    )
  })

  it('foregrounds a newly started media session', () => {
    useMediaProjectionStore.setState({ isPresenting: false })
    renderSync()
    mockStartProjection.mockClear()

    act(() => {
      useMediaProjectionStore.setState({ isPresenting: true })
    })

    expect(mockStartProjection).toHaveBeenCalledWith('media', expect.any(Array), {
      bringToFront: true
    })
  })

  it('does not close projection when Media workspace state becomes inactive', () => {
    renderSync()
    mockStopProjection.mockClear()

    act(() => {
      useMediaProjectionStore.setState({ isPresenting: false })
    })

    expect(mockStopProjection).not.toHaveBeenCalled()
  })

  it('does not synchronize retained Media controls after another owner replaces it', () => {
    projectionState.activeOwner = 'timer'
    renderSync()
    mockProject.mockClear()
    mockStartProjection.mockClear()

    act(() => {
      useMediaProjectionStore.getState().jumpTo(1)
      useMediaProjectionStore.getState().setZoomLevel(1.5)
    })

    expect(mockStartProjection).not.toHaveBeenCalled()
    expect(mockProject).not.toHaveBeenCalled()
  })

  it('does not foreground pan and zoom transport updates', () => {
    renderSync()
    mockProject.mockClear()

    act(() => {
      useMediaProjectionStore.getState().setPan(10, 20)
      useMediaProjectionStore.getState().setZoomLevel(1.5)
    })

    expect(mockProject).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      bringToFront: true
    })
  })

  it('flushes an open editable session before projecting its active slide ID', async () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const activeSlideId = document.slideOrder[0]
    const calls: string[] = []
    const session = {
      commitDraft: vi.fn(() => calls.push('commit')),
      flush: vi.fn(async () => {
        calls.push('flush')
      }),
      getSnapshot: vi.fn(() => {
        calls.push('snapshot')
        return { history: { present: document } }
      })
    } as unknown as PresentationEditorSession
    registryMocks.get.mockReturnValue(session)
    usePresentationWorkspaceStore.getState().setActiveSlideId('editable-deck', activeSlideId)
    useMediaProjectionStore.setState({
      playlist: [makeFile('editable-deck', 'Sunday.lpdeck', EDITABLE_PRESENTATION_MIME_TYPE)],
      currentIndex: 0,
      isPresenting: true,
      typeStates: { presentation: { slideIndex: 0, slideCount: 1 } }
    })

    renderSync()

    await waitFor(() => expect(mockStartProjection).toHaveBeenCalledTimes(1))
    expect(calls).toEqual(['commit', 'flush', 'snapshot'])
    expect(mockStartProjection).toHaveBeenCalledWith(
      'media',
      [
        [
          'file:show',
          expect.objectContaining({
            presentation: { slideIndex: 0, slideCount: 1 },
            editablePresentation: expect.objectContaining({
              slide: expect.objectContaining({ id: activeSlideId })
            })
          })
        ]
      ],
      { bringToFront: false }
    )
  })

  it('does not project when an open editable session cannot flush', async () => {
    const session = {
      commitDraft: vi.fn(),
      flush: vi.fn().mockRejectedValue(new Error('quota exceeded')),
      getSnapshot: vi.fn()
    } as unknown as PresentationEditorSession
    registryMocks.get.mockReturnValue(session)
    useMediaProjectionStore.setState({
      playlist: [makeFile('editable-deck', 'Sunday.lpdeck', EDITABLE_PRESENTATION_MIME_TYPE)],
      currentIndex: 0,
      isPresenting: true,
      typeStates: { presentation: { slideIndex: 0, slideCount: 1 } }
    })

    renderSync()

    await waitFor(() => expect(session.flush).toHaveBeenCalledTimes(1))
    expect(session.getSnapshot).not.toHaveBeenCalled()
    expect(mockStartProjection).not.toHaveBeenCalled()
  })
})
