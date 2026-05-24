import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import NextItemPreview from '../NextItemPreview'
import type { FileItemRecord } from '@shared/types/folder'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock useThumbnails
vi.mock('@renderer/hooks/useThumbnails', () => ({
  useThumbnails: vi.fn()
}))

// Mock file-explorer-db
vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn(),
  getFileBlob: vi.fn()
}))

// Mock pdfjs-loader
vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsLib: vi.fn()
}))

// Mock presentability
vi.mock('@renderer/lib/presentability', () => ({
  getMediaType: vi.fn()
}))

import { useThumbnails } from '@renderer/hooks/useThumbnails'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { getMediaType } from '@renderer/lib/presentability'

const mockUseThumbnails = vi.mocked(useThumbnails)
const mockGetFileBlob = vi.mocked(getFileBlob)
const mockOpenFileExplorerDB = vi.mocked(openFileExplorerDB)
const mockGetMediaType = vi.mocked(getMediaType)

function makeItem(overrides: Partial<FileItemRecord> = {}): FileItemRecord {
  return {
    id: 'item-1',
    parentId: 'folder-1',
    type: 'file',
    sortIndex: 0,
    createdAt: Date.now(),
    expiresAt: null,
    name: 'test.jpg',
    url: '',
    size: 1000,
    mimeType: 'image/jpeg',
    ...overrides
  }
}

describe('NextImagePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenFileExplorerDB.mockResolvedValue({} as never)
  })

  it('shows thumbnail img and does NOT call getFileBlob when thumbnail cached', async () => {
    const item = makeItem()
    mockGetMediaType.mockReturnValue('image')
    mockUseThumbnails.mockReturnValue({ 'item-1': 'data:image/jpeg;base64,abc' })

    render(<NextItemPreview item={item} />)

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,abc')
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('calls getFileBlob when useThumbnails returns null', async () => {
    const item = makeItem()
    mockGetMediaType.mockReturnValue('image')
    mockUseThumbnails.mockReturnValue({ 'item-1': null })

    const blob = new Blob(['fake'], { type: 'image/jpeg' })
    mockGetFileBlob.mockResolvedValue(blob)

    const fakeUrl = 'blob:fake-url'
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeUrl)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<NextItemPreview item={item} />)

    await waitFor(() => {
      expect(mockGetFileBlob).toHaveBeenCalled()
    })
  })

  it('calls getFileBlob when useThumbnails returns empty record (no key)', async () => {
    const item = makeItem()
    mockGetMediaType.mockReturnValue('image')
    mockUseThumbnails.mockReturnValue({})

    const blob = new Blob(['fake'], { type: 'image/jpeg' })
    mockGetFileBlob.mockResolvedValue(blob)

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<NextItemPreview item={item} />)

    await waitFor(() => {
      expect(mockGetFileBlob).toHaveBeenCalled()
    })
  })
})

describe('NextVideoPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenFileExplorerDB.mockResolvedValue({} as never)
  })

  it('shows thumbnail img and does NOT call getFileBlob when thumbnail cached', async () => {
    const item = makeItem({ mimeType: 'video/mp4', name: 'test.mp4' })
    mockGetMediaType.mockReturnValue('video')
    mockUseThumbnails.mockReturnValue({ 'item-1': 'data:image/jpeg;base64,vidthumb' })

    render(<NextItemPreview item={item} />)

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,vidthumb')
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('falls back to video element when no thumbnail', async () => {
    const item = makeItem({ mimeType: 'video/mp4', name: 'test.mp4' })
    mockGetMediaType.mockReturnValue('video')
    mockUseThumbnails.mockReturnValue({ 'item-1': null })

    const blob = new Blob(['fake'], { type: 'video/mp4' })
    mockGetFileBlob.mockResolvedValue(blob)

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:video-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<NextItemPreview item={item} />)

    await waitFor(() => {
      expect(mockGetFileBlob).toHaveBeenCalled()
    })
  })
})

describe('NextPdfPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenFileExplorerDB.mockResolvedValue({} as never)
  })

  it('shows thumbnail img and skips pdfjs when thumbnail cached', async () => {
    const item = makeItem({ mimeType: 'application/pdf', name: 'test.pdf' })
    mockGetMediaType.mockReturnValue('pdf')
    mockUseThumbnails.mockReturnValue({ 'item-1': 'data:image/jpeg;base64,pdfthumb' })

    render(<NextItemPreview item={item} />)

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,pdfthumb')
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('falls back to pdfjs render when no thumbnail', async () => {
    const item = makeItem({ mimeType: 'application/pdf', name: 'test.pdf' })
    mockGetMediaType.mockReturnValue('pdf')
    mockUseThumbnails.mockReturnValue({ 'item-1': null })

    const blob = new Blob(['fake'], { type: 'application/pdf' })
    mockGetFileBlob.mockResolvedValue(blob)

    render(<NextItemPreview item={item} />)

    await waitFor(() => {
      expect(mockGetFileBlob).toHaveBeenCalled()
    })
  })
})
