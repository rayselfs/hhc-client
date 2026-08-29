import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listMediaJobs, resetMediaWorkDBForTests } from '../media-work-db'

const { mockRenderCover, mockRenderPdfPages, mockSaveCover, mockSavePdfPages } = vi.hoisted(() => ({
  mockRenderCover: vi.fn(),
  mockRenderPdfPages: vi.fn(),
  mockSaveCover: vi.fn(),
  mockSavePdfPages: vi.fn()
}))

vi.mock('../thumbnail-worker-client', () => ({
  BackgroundRenderingUnavailableError: class BackgroundRenderingUnavailableError extends Error {},
  renderCoverThumbnail: mockRenderCover,
  renderPdfPageThumbnails: mockRenderPdfPages
}))

vi.mock('../thumbnail-db', () => ({
  getPdfPageThumbs: vi.fn().mockResolvedValue([]),
  saveThumbnail: vi.fn(),
  saveThumbnailBlob: mockSaveCover,
  savePdfPageThumbBlobs: mockSavePdfPages
}))

import { enqueueCoverThumbnailJob } from '../cover-thumbnail-jobs'
import { ensurePdfPageJob } from '../pdf-page-jobs'
import { BackgroundRenderingUnavailableError } from '../thumbnail-worker-client'

describe('background thumbnail jobs', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMediaWorkDBForTests()
  })

  it('stores image covers returned by the Worker as blobs', async () => {
    const cover = new Blob(['cover'], { type: 'image/jpeg' })
    mockRenderCover.mockResolvedValue(cover)

    await enqueueCoverThumbnailJob({
      sourceBlobId: 'image-blob',
      itemId: 'image-item',
      file: new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
      mimeType: 'image/jpeg'
    })

    await vi.waitFor(() => expect(mockSaveCover).toHaveBeenCalledWith('image-blob', cover))
  })

  it('stores PDF pages returned by the Worker as blobs', async () => {
    const pages = [new Blob(['page-1']), new Blob(['page-2'])]
    mockRenderPdfPages.mockResolvedValue(pages)

    await ensurePdfPageJob({
      sourceBlobId: 'pdf-blob',
      itemId: 'pdf-item',
      file: new File(['pdf'], 'slides.pdf', { type: 'application/pdf' })
    })

    await vi.waitFor(() => expect(mockSavePdfPages).toHaveBeenCalledWith('pdf-blob', pages))
    await vi.waitFor(async () => {
      expect((await listMediaJobs())[0]?.status).toBe('completed')
    })
  })

  it('blocks the job instead of falling back to renderer-thread PDF work', async () => {
    mockRenderPdfPages.mockRejectedValue(new BackgroundRenderingUnavailableError())

    await ensurePdfPageJob({
      sourceBlobId: 'unsupported-pdf',
      itemId: 'unsupported-item',
      file: new File(['pdf'], 'slides.pdf', { type: 'application/pdf' })
    })

    await vi.waitFor(async () => {
      expect((await listMediaJobs())[0]).toMatchObject({
        status: 'blocked',
        blockedReason: 'configuration'
      })
    })
  })
})
