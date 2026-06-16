import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import {
  isMediaResourceLocked,
  resetMediaResourceLocksForTests
} from '@renderer/lib/media-resource-locks'
import type { FileItemRecord } from '@shared/types/folder'

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn(async () => ({}) as IDBDatabase),
  getFileBlob: vi.fn(async () => null)
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getThumbnail: vi.fn(async () => null),
  saveThumbnail: vi.fn(async () => undefined)
}))

vi.mock('@renderer/lib/thumbnail-generator', () => ({
  generateThumbnail: vi.fn(async () => null)
}))

function makeFile(id: string, name: string, mimeType = 'image/png'): FileItemRecord {
  return {
    id,
    name,
    mimeType,
    type: 'file',
    sortIndex: 0,
    parentId: 'root',
    size: 1024,
    url: `https://example.com/${id}`,
    createdAt: Date.now(),
    expiresAt: null
  }
}

const files = [makeFile('a', 'a.png'), makeFile('b', 'b.png'), makeFile('c', 'c.png')]

beforeEach(() => {
  useMediaProjectionStore.getState().exit()
  resetMediaResourceLocksForTests()
  useMediaProjectionStore.setState({
    playlist: [],
    currentIndex: 0,
    isPresenting: false,
    isEnded: false,
    showGrid: false,
    typeStates: { pdf: { viewMode: 'slide' } },
    zoomLevel: 1,
    snapshot: null
  })
})

describe('startPresentation', () => {
  it('sets playlist, currentIndex, and isPresenting', () => {
    useMediaProjectionStore.getState().startPresentation(files, 2)
    const s = useMediaProjectionStore.getState()
    expect(s.playlist).toEqual(files)
    expect(s.currentIndex).toBe(2)
    expect(s.isPresenting).toBe(true)
  })

  it('creates an immutable presentation snapshot', () => {
    const playlist = [makeFile('copy-id', 'Original.png')]
    playlist[0].url = 'blob:source-blob'

    useMediaProjectionStore.getState().startPresentation(playlist, 0)
    playlist[0].name = 'Renamed.png'
    playlist[0].url = 'blob:other-blob'

    expect(useMediaProjectionStore.getState().snapshot?.entries[0]).toMatchObject({
      itemId: 'copy-id',
      blobId: 'source-blob',
      name: 'Original.png',
      sourceUrl: 'blob:source-blob'
    })
  })
})

describe('startPresentationWithReadiness', () => {
  it('starts only ready items and returns the readiness report', async () => {
    const playlist = [
      makeFile('bad', 'bad.xyz', 'application/x-unsupported'),
      makeFile('ready-a', 'ready-a.png'),
      makeFile('ready-b', 'ready-b.png')
    ]

    const report = await useMediaProjectionStore
      .getState()
      .startPresentationWithReadiness(playlist, 0)
    const state = useMediaProjectionStore.getState()

    expect(report.summary).toMatchObject({ ready: 2, unsupported: 1 })
    expect(state.isPresenting).toBe(true)
    expect(state.playlist.map((item) => item.id)).toEqual(['ready-a', 'ready-b'])
    expect(state.currentIndex).toBe(0)
    expect(state.snapshot?.entries.map((entry) => entry.itemId)).toEqual(['ready-a', 'ready-b'])
  })

  it('does not start when no items are ready', async () => {
    const report = await useMediaProjectionStore
      .getState()
      .startPresentationWithReadiness([makeFile('bad', 'bad.xyz', 'application/x-unsupported')], 0)
    const state = useMediaProjectionStore.getState()

    expect(report.summary.ready).toBe(0)
    expect(state.isPresenting).toBe(false)
    expect(state.playlist).toEqual([])
  })
})

describe('exit', () => {
  it('resets all state', () => {
    useMediaProjectionStore.getState().startPresentation(files, 1)
    useMediaProjectionStore.getState().exit()
    const s = useMediaProjectionStore.getState()
    expect(s.isPresenting).toBe(false)
    expect(s.playlist).toEqual([])
    expect(s.currentIndex).toBe(0)
    expect(s.showGrid).toBe(false)
    expect(s.snapshot).toBeNull()
  })

  it('releases source blobs locked by the active playlist', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    expect(isMediaResourceLocked('a')).toBe(true)
    expect(isMediaResourceLocked('b')).toBe(true)

    useMediaProjectionStore.getState().exit()

    expect(isMediaResourceLocked('a')).toBe(false)
    expect(isMediaResourceLocked('b')).toBe(false)
  })
})

describe('next / prev', () => {
  beforeEach(() => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
  })

  it('next() increments index', () => {
    useMediaProjectionStore.getState().next()
    expect(useMediaProjectionStore.getState().currentIndex).toBe(1)
  })

  it('next() stops at end', () => {
    useMediaProjectionStore.setState({ currentIndex: 2 })
    useMediaProjectionStore.getState().next()
    expect(useMediaProjectionStore.getState().currentIndex).toBe(2)
  })

  it('prev() decrements index', () => {
    useMediaProjectionStore.setState({ currentIndex: 2 })
    useMediaProjectionStore.getState().prev()
    expect(useMediaProjectionStore.getState().currentIndex).toBe(1)
  })

  it('prev() stops at start', () => {
    useMediaProjectionStore.getState().prev()
    expect(useMediaProjectionStore.getState().currentIndex).toBe(0)
  })
})

describe('canNext / canPrev', () => {
  it('canNext is false at the last index', () => {
    useMediaProjectionStore.getState().startPresentation(files, 2)
    expect(useMediaProjectionStore.getState().canNext()).toBe(false)
  })

  it('canPrev is false at first index', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    expect(useMediaProjectionStore.getState().canPrev()).toBe(false)
  })

  it('canNext is true when not at end', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    expect(useMediaProjectionStore.getState().canNext()).toBe(true)
  })

  it('canPrev is true when not at start', () => {
    useMediaProjectionStore.getState().startPresentation(files, 2)
    expect(useMediaProjectionStore.getState().canPrev()).toBe(true)
  })
})

describe('jumpTo', () => {
  it('sets currentIndex', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    useMediaProjectionStore.getState().jumpTo(2)
    expect(useMediaProjectionStore.getState().currentIndex).toBe(2)
  })

  it('clamps to valid range', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    useMediaProjectionStore.getState().jumpTo(99)
    expect(useMediaProjectionStore.getState().currentIndex).toBe(2)
    useMediaProjectionStore.getState().jumpTo(-5)
    expect(useMediaProjectionStore.getState().currentIndex).toBe(0)
  })
})

describe('toggleGrid', () => {
  it('toggles showGrid', () => {
    expect(useMediaProjectionStore.getState().showGrid).toBe(false)
    useMediaProjectionStore.getState().toggleGrid()
    expect(useMediaProjectionStore.getState().showGrid).toBe(true)
    useMediaProjectionStore.getState().toggleGrid()
    expect(useMediaProjectionStore.getState().showGrid).toBe(false)
  })
})

describe('progress', () => {
  it('returns "0 / 0" for empty playlist', () => {
    expect(useMediaProjectionStore.getState().progress()).toBe('0 / 0')
  })

  it('returns "1 / 3" format', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    expect(useMediaProjectionStore.getState().progress()).toBe('1 / 3')
  })

  it('returns "3 / 3" at last item', () => {
    useMediaProjectionStore.getState().startPresentation(files, 2)
    expect(useMediaProjectionStore.getState().progress()).toBe('3 / 3')
  })
})

describe('currentItem / nextItem / prevItem', () => {
  it('currentItem returns correct file', () => {
    useMediaProjectionStore.getState().startPresentation(files, 1)
    expect(useMediaProjectionStore.getState().currentItem()).toEqual(files[1])
  })

  it('nextItem returns next file', () => {
    useMediaProjectionStore.getState().startPresentation(files, 1)
    expect(useMediaProjectionStore.getState().nextItem()).toEqual(files[2])
  })

  it('prevItem returns previous file', () => {
    useMediaProjectionStore.getState().startPresentation(files, 1)
    expect(useMediaProjectionStore.getState().prevItem()).toEqual(files[0])
  })

  it('currentItem returns null for empty playlist', () => {
    expect(useMediaProjectionStore.getState().currentItem()).toBeNull()
  })

  it('nextItem returns null at end', () => {
    useMediaProjectionStore.getState().startPresentation(files, 2)
    expect(useMediaProjectionStore.getState().nextItem()).toBeNull()
  })

  it('prevItem returns null at start', () => {
    useMediaProjectionStore.getState().startPresentation(files, 0)
    expect(useMediaProjectionStore.getState().prevItem()).toBeNull()
  })
})

describe('updateNotes', () => {
  it('calls useFileExplorerStore.updateItem', async () => {
    const { useFileExplorerStore } = await import('@renderer/stores/file-explorer')
    const mockUpdateItem = vi.fn()
    useFileExplorerStore.setState({ updateItem: mockUpdateItem } as Pick<
      ReturnType<typeof useFileExplorerStore.getState>,
      'updateItem'
    >)

    useMediaProjectionStore.getState().updateNotes('a', 'hello')
    expect(mockUpdateItem).toHaveBeenCalledWith('a', { notes: 'hello' })
  })

  it('preserves other item references when updating notes', async () => {
    const { useFileExplorerStore } = await import('@renderer/stores/file-explorer')
    useFileExplorerStore.setState({ updateItem: vi.fn() } as Pick<
      ReturnType<typeof useFileExplorerStore.getState>,
      'updateItem'
    >)

    useMediaProjectionStore.getState().startPresentation(files, 1)
    const before = useMediaProjectionStore.getState().playlist

    useMediaProjectionStore.getState().updateNotes('b', 'new notes')

    const after = useMediaProjectionStore.getState().playlist
    expect(after[0]).toBe(before[0])
    expect(after[2]).toBe(before[2])
    expect(after[1]).not.toBe(before[1])
    expect(after[1]).toMatchObject({ id: 'b', notes: 'new notes' })
  })
})
