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
    let urls: string[] = []

    const refresh = async (): Promise<void> => {
      const currentRefreshId = ++refreshId
      const entries = await Promise.all(
        pdfItems.map(async (item) => [item.id, await getPdfPageThumbs(getBlobId(item))] as const)
      )
      const nextUrls = entries.flatMap(([, thumbs]) => thumbs)
      if (disposed || currentRefreshId !== refreshId) {
        nextUrls.forEach((url) => URL.revokeObjectURL(url))
        return
      }

      urls.forEach((url) => URL.revokeObjectURL(url))
      urls = nextUrls
      setPdfPageThumbs(Object.fromEntries(entries.filter(([, thumbs]) => thumbs.length > 0)))
    }

    const unsubscribe = subscribeMediaJobs(() => void refresh())
    void refresh()

    return () => {
      disposed = true
      refreshId++
      unsubscribe()
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
    // The key keeps equivalent playlist arrays from restarting the async cache read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistKey])

  return { pdfPageThumbs }
}
