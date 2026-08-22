import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useThumbnails } from '../useThumbnails'
import * as thumbnailDb from '@renderer/lib/thumbnail-db'

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getThumbnail: vi.fn()
}))

const mockGetThumbnail = vi.mocked(thumbnailDb.getThumbnail)

describe('useThumbnails concurrency', () => {
  beforeEach(() => {
    mockGetThumbnail.mockReset()
  })

  it('fetches at most 5 thumbnails concurrently for 20 items', async () => {
    let maxConcurrent = 0
    let currentConcurrent = 0
    let totalStarted = 0

    mockGetThumbnail.mockImplementation(async () => {
      currentConcurrent++
      totalStarted++
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      await new Promise((resolve) => setTimeout(resolve, 5))
      currentConcurrent--
      return 'data:image/jpeg;base64,abc'
    })

    const items = Array.from({ length: 20 }, (_, index) => ({
      id: `item-${index}`,
      url: `blob:item-${index}`,
      mimeType: 'image/jpeg',
      createdAt: 0
    }))
    const { result, unmount } = renderHook(() => useThumbnails(items))

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(20))
    expect(totalStarted).toBe(20)
    expect(currentConcurrent).toBe(0)
    expect(maxConcurrent).toBeLessThanOrEqual(5)
    unmount()
  })
})
