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
    let refreshId = 0
    let ownedThumbs: Record<string, string[]> = {}
    const pdfBlobIds = new Set(pdfItems.map((item) => getBlobId(item)))

    const refresh = async (): Promise<void> => {
      const currentRefreshId = ++refreshId
      const results = await Promise.allSettled(
        pdfItems.map((item) => getPdfPageThumbs(getBlobId(item)))
      )
      const nextUrls = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      )
      if (disposed || currentRefreshId !== refreshId) {
        nextUrls.forEach((url) => URL.revokeObjectURL(url))
        return
      }

      const nextThumbs = { ...ownedThumbs }
      results.forEach((result, index) => {
        if (result.status === 'rejected') return
        const itemId = pdfItems[index].id
        nextThumbs[itemId]?.forEach((url) => URL.revokeObjectURL(url))
        if (result.value.length > 0) nextThumbs[itemId] = result.value
        else delete nextThumbs[itemId]
      })
      ownedThumbs = nextThumbs
      setPdfPageThumbs({ ...nextThumbs })
    }

    const unsubscribe = subscribeMediaJobs((job) => {
      if (
        job?.type === 'pdf-pages' &&
        job.status === 'completed' &&
        job.sourceBlobId &&
        pdfBlobIds.has(job.sourceBlobId)
      ) {
        void refresh()
      }
    })
    void refresh()

    return () => {
      disposed = true
      refreshId++
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
