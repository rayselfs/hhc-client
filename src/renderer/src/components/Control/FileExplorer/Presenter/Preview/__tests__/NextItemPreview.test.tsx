import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import NextItemPreview from '../NextItemPreview'
import type { FileItemRecord } from '@shared/types/folder'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn(),
  getFileBlob: vi.fn()
}))

vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsLib: vi.fn()
}))

vi.mock('@renderer/lib/presentability', () => ({
  getMediaType: vi.fn()
}))

import { getFileBlob } from '@renderer/lib/file-explorer-db'
import { getMediaType } from '@renderer/lib/presentability'

const mockGetFileBlob = vi.mocked(getFileBlob)
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
  })

  it('shows thumbnail img when thumbnail cached', async () => {
    const item = makeItem()
    mockGetMediaType.mockReturnValue('image')

    render(
      <NextItemPreview item={item} previewCache={{ 'item-1': 'data:image/jpeg;base64,abc' }} />
    )

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,abc')
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('shows item name fallback when previewCache has no entry', () => {
    const item = makeItem()
    mockGetMediaType.mockReturnValue('image')

    render(<NextItemPreview item={item} previewCache={{}} />)

    expect(screen.getByText('test.jpg')).toBeTruthy()
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('shows item name fallback when previewCache is undefined', () => {
    const item = makeItem()
    mockGetMediaType.mockReturnValue('image')

    render(<NextItemPreview item={item} />)

    expect(screen.getByText('test.jpg')).toBeTruthy()
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })
})

describe('NextVideoPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows thumbnail img when thumbnail cached', async () => {
    const item = makeItem({ mimeType: 'video/mp4', name: 'test.mp4' })
    mockGetMediaType.mockReturnValue('video')

    render(
      <NextItemPreview item={item} previewCache={{ 'item-1': 'data:image/jpeg;base64,vidthumb' }} />
    )

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,vidthumb')
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('shows item name fallback when no thumbnail', () => {
    const item = makeItem({ mimeType: 'video/mp4', name: 'test.mp4' })
    mockGetMediaType.mockReturnValue('video')

    render(<NextItemPreview item={item} previewCache={{}} />)

    expect(screen.getByText('test.mp4')).toBeTruthy()
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })
})

describe('NextPdfPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows thumbnail img when thumbnail cached', async () => {
    const item = makeItem({ mimeType: 'application/pdf', name: 'test.pdf' })
    mockGetMediaType.mockReturnValue('pdf')

    render(
      <NextItemPreview item={item} previewCache={{ 'item-1': 'data:image/jpeg;base64,pdfthumb' }} />
    )

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,pdfthumb')
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })

  it('shows item name fallback when no thumbnail', () => {
    const item = makeItem({ mimeType: 'application/pdf', name: 'test.pdf' })
    mockGetMediaType.mockReturnValue('pdf')

    render(<NextItemPreview item={item} previewCache={{}} />)

    expect(screen.getByText('test.pdf')).toBeTruthy()
    expect(mockGetFileBlob).not.toHaveBeenCalled()
  })
})
