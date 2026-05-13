import { useEffect, useState } from 'react'
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
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({})
  const { pendingAgeMs } = options

  useEffect(() => {
    let cancelled = false
    const thumbnailItems = items.filter((item) => canHaveThumbnail(item.mimeType))
    const now = Date.now()

    setThumbnails((current) => {
      const next: Record<string, string | null> = {}
      for (const item of thumbnailItems) {
        if (Object.prototype.hasOwnProperty.call(current, item.id)) next[item.id] = current[item.id]
      }
      return next
    })

    async function loadThumbnails(): Promise<void> {
      for (const item of thumbnailItems) {
        if (cancelled) return
        const dataUrl = await getThumbnail(item.id)
        if (dataUrl !== null) {
          setThumbnails((prev) => ({ ...prev, [item.id]: dataUrl }))
        } else if (pendingAgeMs === undefined || now - (item.createdAt ?? 0) > pendingAgeMs) {
          setThumbnails((prev) => ({ ...prev, [item.id]: null }))
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
      const { itemId, dataUrl } = (
        e as CustomEvent<{ itemId: string; dataUrl: string | null }>
      ).detail
      setThumbnails((prev) => ({ ...prev, [itemId]: dataUrl }))
    }
    window.addEventListener('hhc:thumbnail-ready', onThumbnailReady)
    return () => window.removeEventListener('hhc:thumbnail-ready', onThumbnailReady)
  }, [])

  return thumbnails
}
