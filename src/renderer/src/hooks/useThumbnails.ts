import { useEffect, useMemo, useState } from 'react'
import { getThumbnail } from '@renderer/lib/thumbnail-db'

export function canHaveThumbnail(mimeType: string | undefined): boolean {
  return (
    mimeType?.startsWith('image/') === true ||
    mimeType?.startsWith('video/') === true ||
    mimeType === 'application/pdf'
  )
}

interface ThumbnailItem {
  id: string
  mimeType?: string
  createdAt?: number
}

interface UseThumbnailsOptions {
  pendingAgeMs?: number
}

export function useThumbnails(
  items: ThumbnailItem[],
  options: UseThumbnailsOptions = {}
): Record<string, string | null> {
  const [allThumbnails, setAllThumbnails] = useState<Record<string, string | null>>({})
  const { pendingAgeMs } = options

  const thumbnailItemIds = useMemo(
    () => new Set(items.filter((item) => canHaveThumbnail(item.mimeType)).map((i) => i.id)),
    [items]
  )

  const thumbnails = useMemo(
    () =>
      Object.fromEntries(Object.entries(allThumbnails).filter(([k]) => thumbnailItemIds.has(k))),
    [allThumbnails, thumbnailItemIds]
  )

  useEffect(() => {
    let cancelled = false
    const thumbnailItems = items.filter((item) => canHaveThumbnail(item.mimeType))
    const now = Date.now()

    async function loadThumbnails(): Promise<void> {
      for (const item of thumbnailItems) {
        if (cancelled) return
        const dataUrl = await getThumbnail(item.id)
        if (dataUrl !== null) {
          setAllThumbnails((prev) => ({ ...prev, [item.id]: dataUrl }))
        } else if (pendingAgeMs === undefined || now - (item.createdAt ?? 0) > pendingAgeMs) {
          setAllThumbnails((prev) => ({ ...prev, [item.id]: null }))
        }
      }
    }

    void loadThumbnails()

    return () => {
      cancelled = true
    }
  }, [items, pendingAgeMs])

  useEffect(() => {
    const onThumbnailReady = (e: Event): void => {
      const { itemId, dataUrl } = (e as CustomEvent<{ itemId: string; dataUrl: string | null }>)
        .detail
      setAllThumbnails((prev) => ({ ...prev, [itemId]: dataUrl }))
    }
    window.addEventListener('hhc:thumbnail-ready', onThumbnailReady)
    return () => window.removeEventListener('hhc:thumbnail-ready', onThumbnailReady)
  }, [])

  return thumbnails
}
