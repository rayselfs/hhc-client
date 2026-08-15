import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openPptxViewer } from '../pptx-renderer-service'

const { mockPptxViewerOpen } = vi.hoisted(() => ({
  mockPptxViewerOpen: vi.fn()
}))

vi.mock('@aiden0z/pptx-renderer', () => ({
  PptxViewer: { open: mockPptxViewerOpen },
  RECOMMENDED_ZIP_LIMITS: { maxEntries: 100 }
}))

describe('openPptxViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPptxViewerOpen.mockResolvedValue({
      slideCount: 1,
      slideWidth: 1024,
      slideHeight: 768,
      destroy: vi.fn()
    })
  })

  it('opens a 4:3 slide with renderer containment and preserves its dimensions', async () => {
    const source = new ArrayBuffer(8)
    const container = document.createElement('div')

    const handle = await openPptxViewer(source, container, { renderMode: 'slide' })

    expect(mockPptxViewerOpen).toHaveBeenCalledWith(
      source,
      container,
      expect.objectContaining({ renderMode: 'slide', fitMode: 'contain' })
    )
    expect(handle).toMatchObject({ slideWidth: 1024, slideHeight: 768 })
  })
})
