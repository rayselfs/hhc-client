import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import type { FileItemRecord } from '@shared/types/folder'

const mockSend = vi.fn()
const mockProject = vi.fn()
const mockBlankProjection = vi.fn()

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    send: mockSend,
    project: mockProject,
    blankProjection: mockBlankProjection
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
  vi.stubGlobal('window', {
    api: {
      videoTranscode: {
        startLive: vi.fn().mockResolvedValue({
          sessionId: 'live-session',
          url: 'hhc-live-media://stream/live-session',
          mimeType: 'video/mp4'
        }),
        stopLive: vi.fn().mockResolvedValue(undefined)
      }
    }
  })
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
      expect.objectContaining({ currentIndex: 1, itemId: 'b', blobId: 'b' })
    )
  })

  it('sends separate item and blob identities for copied media', () => {
    useMediaProjectionStore.setState({
      playlist: [makeFile('copy-id', 'copy.png', 'image/png', 'original-id')],
      currentIndex: 0,
      isPresenting: true
    })

    renderSync()

    expect(mockProject).toHaveBeenCalledWith(
      'file:show',
      expect.objectContaining({ itemId: 'copy-id', blobId: 'original-id' })
    )
  })

  it('starts a live transcode session before projecting an unconverted electron video', async () => {
    useMediaProjectionStore.setState({
      playlist: [makeFile('live-item', 'live.mkv', 'video/x-matroska', 'source-blob')],
      currentIndex: 0,
      isPresenting: true,
      snapshot: {
        id: 'snapshot',
        createdAt: 1,
        entries: [
          {
            index: 0,
            itemId: 'live-item',
            blobId: 'source-blob',
            name: 'live.mkv',
            mimeType: 'video/x-matroska',
            sourceUrl: 'blob:source-blob',
            playbackMode: 'live-transcode',
            seekable: false
          }
        ]
      }
    })

    renderSync()

    await vi.waitFor(() => {
      expect(window.api.videoTranscode.startLive).toHaveBeenCalledWith({
        sourceFileId: 'source-blob',
        profile: { resolution: '1080p', quality: 'high' },
        sourceMetadata: undefined
      })
      expect(mockProject).toHaveBeenCalledWith(
        'file:show',
        expect.objectContaining({
          itemId: 'live-item',
          blobId: 'source-blob',
          streamUrl: 'hhc-live-media://stream/live-session',
          playbackMode: 'live-transcode',
          seekable: false
        })
      )
    })
  })

  it('projects embedded VLC video without starting live transcode', async () => {
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

    expect(window.api.videoTranscode.startLive).not.toHaveBeenCalled()
    expect(mockProject).toHaveBeenCalledWith(
      'file:show',
      expect.objectContaining({
        itemId: 'vlc-item',
        blobId: 'source-blob',
        playbackMode: 'vlc-embedded',
        seekable: true,
        durationMs: 15000
      })
    )
  })

  it('logs and skips projection when live transcode startup fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    window.api.videoTranscode.startLive = vi.fn().mockRejectedValue(new Error('ffmpeg failed'))
    useMediaProjectionStore.setState({
      playlist: [makeFile('live-item', 'live.mkv', 'video/x-matroska', 'source-blob')],
      currentIndex: 0,
      isPresenting: true,
      snapshot: {
        id: 'snapshot',
        createdAt: 1,
        entries: [
          {
            index: 0,
            itemId: 'live-item',
            blobId: 'source-blob',
            name: 'live.mkv',
            mimeType: 'video/x-matroska',
            sourceUrl: 'blob:source-blob',
            playbackMode: 'live-transcode',
            seekable: false
          }
        ]
      }
    })

    renderSync()

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        '[media-projection] Failed to start live transcode',
        expect.any(Error)
      )
    })
    expect(mockProject).not.toHaveBeenCalledWith('file:show', expect.anything())
    errorSpy.mockRestore()
  })
})
