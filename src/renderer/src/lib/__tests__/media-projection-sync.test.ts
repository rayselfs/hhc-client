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
  useMediaProjectionStore.setState({
    playlist: [makeFile('a', 'a.png'), makeFile('b', 'b.png')],
    currentIndex: 0,
    isPresenting: true,
    isRehearsal: false,
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
      isPresenting: true,
      isRehearsal: false
    })

    renderSync()

    expect(mockProject).toHaveBeenCalledWith(
      'file:show',
      expect.objectContaining({ itemId: 'copy-id', blobId: 'original-id' })
    )
  })

  it('does not send projection output during rehearsal', () => {
    useMediaProjectionStore.setState({ isRehearsal: true })

    renderSync()

    expect(mockProject).not.toHaveBeenCalledWith('file:show', expect.anything())

    act(() => {
      useMediaProjectionStore.getState().jumpTo(1)
    })

    expect(mockProject).not.toHaveBeenCalledWith('file:show', expect.anything())
  })
})
