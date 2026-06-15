import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
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
): { id: string; url: string; mimeType: string; createdAt: number } {
  return { id, url: `blob:${id}`, mimeType, createdAt }
}

describe('useThumbnails', () => {
  beforeEach(() => {
    mockGetThumbnail.mockReset()
  })

  describe('cache pruning', () => {
    it('removes keys no longer in items when items array changes', async () => {
      mockGetThumbnail.mockResolvedValue('data:image/jpeg;base64,abc')

      const itemsABC = [makeItem('A'), makeItem('B'), makeItem('C')]
      const { result, rerender, unmount } = renderHook(({ items }) => useThumbnails(items), {
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
      unmount()
    })
  })

  it('loads copied items from their canonical blob identity', async () => {
    mockGetThumbnail.mockResolvedValue('blob:shared-cover')

    const items = [
      {
        id: 'copy-item',
        url: 'blob:original-blob',
        mimeType: 'image/jpeg',
        createdAt: 0
      }
    ]
    const { unmount } = renderHook(() => useThumbnails(items))

    await waitFor(() => {
      expect(mockGetThumbnail).toHaveBeenCalledWith('copy-item', 'original-blob')
    })
    unmount()
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
      const { result, rerender, unmount } = renderHook(({ items }) => useThumbnails(items), {
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
      unmount()
    })
  })
})
