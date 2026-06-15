import { useEffect, useMemo, useRef, useState } from 'react'
import { getThumbnail } from '@renderer/lib/thumbnail-db'
import { canGenerateMediaThumbnail, resolveMediaCapability } from '@renderer/lib/media-capabilities'

export function canHaveThumbnail(mimeType: string | undefined): boolean {
  return canGenerateMediaThumbnail(resolveMediaCapability({ mimeType }))
}

function revokeIfBlobUrl(url: string | null): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

function createSemaphore(limit: number): { acquire(): Promise<() => void> } {
  let active = 0
  const queue: Array<() => void> = []

  function acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = (): void => {
        if (active < limit) {
          active++
          resolve(() => {
            active--
            if (queue.length > 0) {
              const next = queue.shift()!
              next()
            }
          })
        } else {
          queue.push(tryAcquire)
        }
      }
      tryAcquire()
    })
  }

  return { acquire }
}

const THUMBNAIL_LOAD_CONCURRENCY = 5

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

  const itemsKey = useMemo(
    () =>
      items
        .filter((item) => canHaveThumbnail(item.mimeType))
        .map((i) => `${i.id}:${i.createdAt ?? 0}`)
        .join(','),
    [items]
  )

  const itemsRef = useRef(items)
  itemsRef.current = items

  // Prune stale keys when items change
  useEffect(() => {
    setAllThumbnails((prev) => {
      const idsSet = thumbnailItemIds
      const pruned: Record<string, string | null> = {}
      for (const [id, url] of Object.entries(prev)) {
        if (idsSet.has(id)) {
          pruned[id] = url
        } else {
          revokeIfBlobUrl(url)
        }
      }
      return pruned
    })
  }, [thumbnailItemIds])

  useEffect(() => {
    let cancelled = false
    const thumbnailItems = itemsRef.current.filter((item) => canHaveThumbnail(item.mimeType))
    const now = Date.now()
    const semaphore = createSemaphore(THUMBNAIL_LOAD_CONCURRENCY)

    async function loadThumbnails(): Promise<void> {
      await Promise.all(
        thumbnailItems.map(async (item) => {
          const release = await semaphore.acquire()
          try {
            if (cancelled) return
            const dataUrl = await getThumbnail(item.id)
            if (cancelled) return
            if (dataUrl !== null) {
              setAllThumbnails((prev) => {
                revokeIfBlobUrl(prev[item.id] ?? null)
                return { ...prev, [item.id]: dataUrl }
              })
            } else if (pendingAgeMs === undefined || now - (item.createdAt ?? 0) > pendingAgeMs) {
              setAllThumbnails((prev) => {
                revokeIfBlobUrl(prev[item.id] ?? null)
                return { ...prev, [item.id]: null }
              })
            }
          } finally {
            release()
          }
        })
      )
    }

    void loadThumbnails()

    return () => {
      cancelled = true
    }
  }, [itemsKey, pendingAgeMs])

  useEffect(() => {
    const onThumbnailReady = (e: Event): void => {
      const { itemId, dataUrl } = (e as CustomEvent<{ itemId: string; dataUrl: string | null }>)
        .detail
      setAllThumbnails((prev) => {
        revokeIfBlobUrl(prev[itemId] ?? null)
        return { ...prev, [itemId]: dataUrl }
      })
    }
    window.addEventListener('hhc:thumbnail-ready', onThumbnailReady)
    return () => window.removeEventListener('hhc:thumbnail-ready', onThumbnailReady)
  }, [])

  return thumbnails
}
