import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { getThumbnail, saveThumbnail } from '@renderer/lib/thumbnail-db'
import { getFileBlob, openFileExplorerDB } from '@renderer/lib/file-explorer-db'

vi.mock('@renderer/lib/thumbnail-generator', () => ({
  generateThumbnail: vi.fn()
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getThumbnail: vi.fn(),
  saveThumbnail: vi.fn()
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn(),
  getFileBlob: vi.fn()
}))

const generateThumbnailMock = vi.mocked(generateThumbnail)
const getThumbnailMock = vi.mocked(getThumbnail)
const saveThumbnailMock = vi.mocked(saveThumbnail)
const openFileExplorerDBMock = vi.mocked(openFileExplorerDB)
const getFileBlobMock = vi.mocked(getFileBlob)

function makeFile(id: string): FileItemRecord {
  return {
    id,
    name: `${id}.png`,
    mimeType: 'image/png',
    type: 'file',
    sortIndex: 0,
    parentId: 'root',
    size: 1024,
    url: `https://example.com/${id}`,
    createdAt: Date.now(),
    expiresAt: null
  }
}

const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.clearAllMocks()
  useMediaProjectionStore.getState().exit()
  useMediaProjectionStore.setState({
    playlist: [],
    currentIndex: 0,
    isPresenting: false,
    showGrid: false,
    typeStates: { pdf: { viewMode: 'slide' } },
    zoomLevel: 1,
    pan: { x: 0, y: 0 }
  })
  openFileExplorerDBMock.mockResolvedValue({} as Awaited<ReturnType<typeof openFileExplorerDB>>)
  getFileBlobMock.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
  saveThumbnailMock.mockResolvedValue(undefined)
})

afterEach(() => {
  useMediaProjectionStore.getState().exit()
})

describe('media projection thumbnail pre-generation', () => {
  it('generates thumbnails only for items missing thumbnails', async () => {
    const files = ['a', 'b', 'c', 'd', 'e'].map(makeFile)
    getThumbnailMock.mockImplementation(async (itemId) =>
      itemId === 'b' || itemId === 'd' ? `existing-${itemId}` : null
    )
    generateThumbnailMock.mockImplementation(async (file) => `generated-${file.name}`)

    useMediaProjectionStore.getState().startPresentation(files, 0)
    await flushPromises()
    await vi.waitFor(() => expect(generateThumbnailMock).toHaveBeenCalledTimes(3))

    expect(getThumbnailMock).toHaveBeenCalledTimes(5)
    expect(saveThumbnailMock).toHaveBeenCalledTimes(3)
    expect(saveThumbnailMock).toHaveBeenCalledWith('a', 'generated-a.png')
    expect(saveThumbnailMock).toHaveBeenCalledWith('c', 'generated-c.png')
    expect(saveThumbnailMock).toHaveBeenCalledWith('e', 'generated-e.png')
  })

  it('aborts in-progress pre-generation on exit', async () => {
    const files = ['a', 'b', 'c', 'd', 'e'].map(makeFile)
    let releaseGeneration: () => void = () => {}
    const firstGenerationPromise = new Promise<void>((resolve) => {
      releaseGeneration = resolve
    })

    getThumbnailMock.mockResolvedValue(null)
    generateThumbnailMock.mockImplementation(async () => {
      await firstGenerationPromise
      return 'generated-thumbnail'
    })

    useMediaProjectionStore.getState().startPresentation(files, 0)
    await vi.waitFor(() => expect(generateThumbnailMock).toHaveBeenCalledTimes(3))

    useMediaProjectionStore.getState().exit()
    releaseGeneration()
    await flushPromises()
    await flushPromises()

    expect(generateThumbnailMock.mock.calls.length).toBeLessThan(files.length)
    expect(saveThumbnailMock).not.toHaveBeenCalled()
  })

  it('dispatches hhc:thumbnail-ready for each new thumbnail', async () => {
    const files = ['a', 'b', 'c'].map(makeFile)
    const listener = vi.fn()
    window.addEventListener('hhc:thumbnail-ready', listener)
    getThumbnailMock.mockResolvedValue(null)
    generateThumbnailMock.mockImplementation(async (file) => `generated-${file.name}`)

    try {
      useMediaProjectionStore.getState().startPresentation(files, 0)
      await flushPromises()
      await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(3))

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { itemId: 'a', dataUrl: 'generated-a.png' } })
      )
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { itemId: 'b', dataUrl: 'generated-b.png' } })
      )
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { itemId: 'c', dataUrl: 'generated-c.png' } })
      )
    } finally {
      window.removeEventListener('hhc:thumbnail-ready', listener)
    }
  })
})
