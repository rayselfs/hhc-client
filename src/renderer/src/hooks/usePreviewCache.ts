import { useEffect, useMemo, useState } from 'react'
import type { FileItemRecord } from '@shared/types/folder'
import { getBlobId } from '@renderer/lib/blob-identity'
import { subscribeMediaJobs } from '@renderer/lib/media-work-db'
import { getPdfPageThumbs } from '@renderer/lib/thumbnail-db'

export type PreviewCacheResult = {
  pdfPageThumbs: Record<string, string[]>
}

export function usePreviewCache(playlist: FileItemRecord[]): PreviewCacheResult {
  const [pdfPageThumbs, setPdfPageThumbs] = useState<Record<string, string[]>>({})
  const playlistKey = useMemo(
    () =>
      playlist
        .filter((item) => item.mimeType === 'application/pdf')
        .map((item) => `${item.id}:${getBlobId(item)}`)
        .join(','),
    [playlist]
  )

  useEffect(() => {
    const pdfItems = playlist.filter((item) => item.mimeType === 'application/pdf')
    setPdfPageThumbs({})
    if (pdfItems.length === 0) return

    let disposed = false
    const refreshIds = new Map<string, number>()
    const ownedThumbs: Record<string, string[]> = {}
    const pdfBlobIds = new Set(pdfItems.map((item) => getBlobId(item)))

    const refresh = async (items: FileItemRecord[]): Promise<void> => {
      const requests = items.map((item) => {
        const refreshId = (refreshIds.get(item.id) ?? 0) + 1
        refreshIds.set(item.id, refreshId)
        return { item, refreshId }
      })
      const results = await Promise.allSettled(
        requests.map(({ item }) => getPdfPageThumbs(getBlobId(item)))
      )

      let changed = false
      results.forEach((result, index) => {
        if (result.status === 'rejected') return
        const { item, refreshId } = requests[index]
        if (disposed || refreshIds.get(item.id) !== refreshId) {
          result.value.forEach((url) => URL.revokeObjectURL(url))
          return
        }
        ownedThumbs[item.id]?.forEach((url) => URL.revokeObjectURL(url))
        if (result.value.length > 0) ownedThumbs[item.id] = result.value
        else delete ownedThumbs[item.id]
        changed = true
      })
      if (changed) setPdfPageThumbs({ ...ownedThumbs })
    }

    const unsubscribe = subscribeMediaJobs((job) => {
      if (
        job?.type === 'pdf-pages' &&
        job.status === 'completed' &&
        job.sourceBlobId &&
        pdfBlobIds.has(job.sourceBlobId)
      ) {
        void refresh(pdfItems.filter((item) => getBlobId(item) === job.sourceBlobId))
      }
    })
    void refresh(pdfItems)

    return () => {
      disposed = true
      unsubscribe()
      Object.values(ownedThumbs)
        .flat()
        .forEach((url) => URL.revokeObjectURL(url))
    }
    // The key keeps equivalent playlist arrays from restarting the async cache read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistKey])

  return { pdfPageThumbs }
}
