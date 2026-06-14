import { act, renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useThumbnails } from '../useThumbnails'
import * as thumbnailDb from '@renderer/lib/thumbnail-db'

vi.mock('@renderer/lib/thumbnail-db', () => ({
  getThumbnail: vi.fn()
}))

const mockGetThumbnail = vi.mocked(thumbnailDb.getThumbnail)

function makeItem(
  id: string,
  mimeType = 'image/jpeg',
  createdAt = 0
): { id: string; mimeType: string; createdAt: number } {
  return { id, mimeType, createdAt }
}

describe('useThumbnails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('bounded concurrency', () => {
    it('fetches at most 5 thumbnails concurrently for 20 items', async () => {
      let maxConcurrent = 0
      let currentConcurrent = 0
      let totalStarted = 0
      const resolvers: Array<() => void> = []

      mockGetThumbnail.mockImplementation(() => {
        currentConcurrent++
        totalStarted++
        if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent
        return new Promise<string | null>((resolve) => {
          resolvers.push(() => {
            currentConcurrent--
            resolve('data:image/jpeg;base64,abc')
          })
        })
      })

      const items = Array.from({ length: 20 }, (_, i) => makeItem(`item-${i}`))
      renderHook(() => useThumbnails(items))

      // Wait for first batch to start (up to 5)
      await waitFor(() => expect(totalStarted).toBeGreaterThanOrEqual(5))

      // At this point, max concurrent should be ≤ 5
      expect(maxConcurrent).toBeLessThanOrEqual(5)
      expect(currentConcurrent).toBeLessThanOrEqual(5)

      // Resolve all pending and let the rest run
      while (resolvers.length > 0) {
        await act(async () => {
          resolvers.splice(0).forEach((resolve) => resolve())
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
      }

      await waitFor(() => expect(totalStarted).toBe(20))
      expect(maxConcurrent).toBeLessThanOrEqual(5)
    })
  })

  describe('cache pruning', () => {
    it('removes keys no longer in items when items array changes', async () => {
      mockGetThumbnail.mockResolvedValue('data:image/jpeg;base64,abc')

      const itemsABC = [makeItem('A'), makeItem('B'), makeItem('C')]
      const { result, rerender } = renderHook(({ items }) => useThumbnails(items), {
        initialProps: { items: itemsABC }
      })

      await waitFor(() => {
        expect(Object.keys(result.current)).toContain('A')
        expect(Object.keys(result.current)).toContain('B')
        expect(Object.keys(result.current)).toContain('C')
      })

      // Remove B
      const itemsAC = [makeItem('A'), makeItem('C')]
      rerender({ items: itemsAC })

      await waitFor(() => {
        expect(Object.keys(result.current)).not.toContain('B')
        expect(Object.keys(result.current)).toContain('A')
        expect(Object.keys(result.current)).toContain('C')
      })
    })
  })

  describe('revokeIfBlobUrl', () => {
    it('calls URL.revokeObjectURL for removed blob: URLs', async () => {
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { ...URL, revokeObjectURL })

      // First render: A has blob URL, B has data URL
      mockGetThumbnail.mockImplementation(async (id: string) => {
        if (id === 'A') return 'blob:http://localhost/fake-blob-id'
        if (id === 'B') return 'data:image/jpeg;base64,abc'
        return null
      })

      const itemsAB = [makeItem('A'), makeItem('B')]
      const { result, rerender } = renderHook(({ items }) => useThumbnails(items), {
        initialProps: { items: itemsAB }
      })

      await waitFor(() => {
        expect(result.current['A']).toBe('blob:http://localhost/fake-blob-id')
        expect(result.current['B']).toBe('data:image/jpeg;base64,abc')
      })

      // Remove A (which has blob URL)
      rerender({ items: [makeItem('B')] })

      await waitFor(() => {
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-blob-id')
      })

      // B's data URL should NOT trigger revoke
      expect(revokeObjectURL).not.toHaveBeenCalledWith('data:image/jpeg;base64,abc')
    })
  })
})
