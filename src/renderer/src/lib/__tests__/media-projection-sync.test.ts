import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import type { FileItemRecord } from '@shared/types/folder'

const mockProject = vi.fn()
const mockStartProjection = vi.fn(() => Promise.resolve())
const mockStopProjection = vi.fn(() => Promise.resolve())

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    project: mockProject,
    startProjection: mockStartProjection,
    stopProjection: mockStopProjection
  })
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

  it('does not foreground pan and zoom transport updates', () => {
    renderSync()
    mockProject.mockClear()

    act(() => {
      useMediaProjectionStore.getState().setPan({ x: 10, y: 20 })
      useMediaProjectionStore.getState().setZoomLevel(1.5)
    })

    expect(mockProject).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { bringToFront: true }
    )
  })
})
