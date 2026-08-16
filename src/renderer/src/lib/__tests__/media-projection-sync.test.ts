import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
const remoteMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  ensurePersistent: vi.fn()
}))
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

vi.mock('../hhc-line-connect', () => ({
  prepareHhcLinePresentationSource: remoteMocks.prepare,
  ensureHhcLineDesktopItemAvailableForPresentation: remoteMocks.ensurePersistent
}))

import { useMediaProjectionSync } from '../media-projection-sync'

function renderSync(
  options?: Parameters<typeof useMediaProjectionSync>[0]
): ReturnType<typeof renderHook> {
  return renderHook(() => useMediaProjectionSync(options))
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
  remoteMocks.prepare.mockResolvedValue(null)
  remoteMocks.ensurePersistent.mockResolvedValue(false)
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

afterEach(() => {
  vi.useRealTimers()
})

describe('media projection sync', () => {
  it('renews an expiring browser source authoritatively without persisting its ticket', async () => {
    vi.useFakeTimers()
    const item = makeFile('remote', 'remote.mp4', 'video/mp4')
    useMediaProjectionStore.setState({
      playlist: [item],
      currentIndex: 0,
      isPresenting: true,
      snapshot: {
        id: 'snapshot',
        createdAt: 1,
        entries: [
          {
            index: 0,
            itemId: item.id,
            blobId: item.id,
            name: item.name,
            mimeType: item.mimeType,
            sourceUrl: item.url,
            remoteItem: {
              providerConnectionId: 'hhc-line:user-1',
              remoteItemId: 'asset-1',
              rootRemoteFolderId: 'collection-1'
            }
          }
        ]
      }
    })
    remoteMocks.prepare
      .mockResolvedValueOnce({
        providerConnectionId: 'hhc-line:user-1',
        remoteItemId: 'asset-1',
        rootRemoteFolderId: 'collection-1',
        source: {
          kind: 'ticket',
          url: 'https://www.alive.org.tw/api/assets/content?ticket=first',
          expiresAt: Date.now() + 60_000,
          etag: 'etag-1'
        }
      })
      .mockResolvedValueOnce({
        providerConnectionId: 'hhc-line:user-1',
        remoteItemId: 'asset-1',
        rootRemoteFolderId: 'collection-1',
        source: {
          kind: 'ticket',
          url: 'https://www.alive.org.tw/api/assets/content?ticket=second',
          expiresAt: Date.now() + 60_000,
          etag: 'etag-1'
        }
      })

    renderSync({
      auth: {
        getSession: () => ({ userId: 'user-1', displayName: 'Ada', roles: [] }),
        getAccessToken: vi.fn(),
        refreshAccessToken: vi.fn()
      }
    })
    await act(async () => Promise.resolve())
    expect(mockStartProjection).toHaveBeenCalledWith(
      'media',
      [
        [
          'file:show',
          expect.objectContaining({ streamUrl: expect.stringContaining('ticket=first') })
        ]
      ],
      { bringToFront: false }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockProject).toHaveBeenCalledWith(
      'file:show',
      expect.objectContaining({ streamUrl: expect.stringContaining('ticket=second') }),
      { bringToFront: false }
    )
    expect(item.url).toBe('blob:remote')
    vi.useRealTimers()
  })

  it('keeps the current source on retryable renewal failure and emits access-revoked only for 403', async () => {
    vi.useFakeTimers()
    const onAccessRevoked = vi.fn()
    const error = Object.assign(new Error('retry'), { classification: 'retryable' })
    remoteMocks.prepare
      .mockResolvedValueOnce({
        providerConnectionId: 'hhc-line:user-1',
        remoteItemId: 'asset-1',
        rootRemoteFolderId: 'collection-1',
        source: {
          kind: 'ticket',
          url: 'https://www.alive.org.tw/api/assets/content?ticket=current',
          expiresAt: Date.now() + 60_000,
          etag: 'etag-1'
        }
      })
      .mockRejectedValueOnce(error)
    useMediaProjectionStore.setState({
      snapshot: {
        id: 'snapshot',
        createdAt: 1,
        entries: [
          {
            index: 0,
            itemId: 'a',
            blobId: 'a',
            name: 'a.png',
            mimeType: 'image/png',
            sourceUrl: 'blob:a',
            remoteItem: {
              providerConnectionId: 'hhc-line:user-1',
              remoteItemId: 'asset-1',
              rootRemoteFolderId: 'collection-1'
            }
          },
          {
            index: 1,
            itemId: 'b',
            blobId: 'b',
            name: 'b.png',
            mimeType: 'image/png',
            sourceUrl: 'blob:b',
            remoteItem: {
              providerConnectionId: 'hhc-line:user-1',
              remoteItemId: 'asset-2',
              rootRemoteFolderId: 'collection-1'
            }
          }
        ]
      }
    })

    renderSync({
      auth: {
        getSession: () => ({ userId: 'user-1', displayName: 'Ada', roles: [] }),
        getAccessToken: vi.fn(),
        refreshAccessToken: vi.fn()
      },
      onAccessRevoked
    })
    await act(async () => Promise.resolve())
    expect(onAccessRevoked).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(useMediaProjectionStore.getState().snapshot?.entries[0].sourceUrl).toContain(
      'ticket=current'
    )

    remoteMocks.prepare.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), {
        classification: 'access-revoked',
        providerConnectionId: 'hhc-line:user-1',
        remoteItemId: 'asset-1'
      })
    )
    act(() => useMediaProjectionStore.getState().jumpTo(1))
    await act(async () => Promise.resolve())
    expect(onAccessRevoked).toHaveBeenCalledWith({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1'
    })
    vi.useRealTimers()
  })

  it('releases an Electron lease and stops presentation when the HHC session ends', async () => {
    const releaseContentLease = vi.fn(async () => undefined)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { hhcAssets: { releaseContentLease } }
    })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: [] } as {
        userId: string
        displayName: string
        roles: string[]
      } | null
    }
    const auth = {
      getSession: () => sessionRef.current,
      getAccessToken: vi.fn(),
      refreshAccessToken: vi.fn()
    }
    useMediaProjectionStore.setState({
      snapshot: {
        id: 'snapshot',
        createdAt: 1,
        entries: [
          {
            index: 0,
            itemId: 'a',
            blobId: 'a',
            name: 'a.png',
            mimeType: 'image/png',
            sourceUrl: 'blob:a',
            remoteItem: {
              providerConnectionId: 'hhc-line:user-1',
              remoteItemId: 'asset-1',
              rootRemoteFolderId: 'collection-1'
            }
          }
        ]
      }
    })
    remoteMocks.prepare.mockResolvedValueOnce({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      rootRemoteFolderId: 'collection-1',
      source: {
        kind: 'native-lease',
        url: 'hhc-media://lease/123e4567-e89b-12d3-a456-426614174000?type=image%2Fpng',
        leaseId: '123e4567-e89b-12d3-a456-426614174000',
        etag: 'etag-1'
      }
    })

    const { rerender } = renderHook(() => useMediaProjectionSync({ auth }))
    await act(async () => Promise.resolve())
    sessionRef.current = null
    rerender()

    await waitFor(() => {
      expect(releaseContentLease).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
      expect(mockStopProjection).toHaveBeenCalled()
    })
  })
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
