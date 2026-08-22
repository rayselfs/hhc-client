import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileItemRecord } from '@shared/types/folder'
import { getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { getBlobId } from '@renderer/lib/blob-identity'
import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'
import { getPdfPageThumbs, savePdfPageThumbBlobs } from '@renderer/lib/thumbnail-db'

function canPreload(mimeType: string | undefined): boolean {
  return (
    mimeType?.startsWith('image/') === true ||
    mimeType?.startsWith('video/') === true ||
    mimeType === 'application/pdf'
  )
}

function createSemaphore(limit: number): { acquire(): Promise<() => void> } {
  let active = 0
  const queue: Array<() => void> = []

  return {
    acquire(): Promise<() => void> {
      return new Promise((resolve) => {
        const tryAcquire = (): void => {
          if (active < limit) {
            active++
            resolve(() => {
              active--
              queue.shift()?.()
            })
            return
          }
          queue.push(tryAcquire)
        }
        tryAcquire()
      })
    }
  }
}

async function captureVideoThumb(sourceUrl: string, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    const cleanup = (): void => {
      video.src = ''
    }

    if (signal.aborted) {
      cleanup()
      resolve(null)
      return
    }

    video.onloadeddata = (): void => {
      video.currentTime = 0.1
    }

    video.onseeked = (): void => {
      if (signal.aborted) {
        cleanup()
        resolve(null)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 320
      canvas.height = video.videoHeight || 180
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        cleanup()
        resolve(null)
        return
      }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => {
          cleanup()
          if (blob && !signal.aborted) {
            resolve(URL.createObjectURL(blob))
          } else {
            resolve(null)
          }
        },
        'image/jpeg',
        0.8
      )
    }

    video.onerror = (): void => {
      cleanup()
      resolve(null)
    }

    video.src = sourceUrl
  })
}

interface RenderedPdfThumbs {
  blobs: Blob[]
  urls: string[]
}

async function renderPdfPageThumb(
  sourceUrl: string,
  signal: AbortSignal
): Promise<RenderedPdfThumbs> {
  const pdfjsLib = await loadPdfjsLib()
  if (signal.aborted) return { blobs: [], urls: [] }

  const pdf = await pdfjsLib.getDocument({ url: sourceUrl }).promise
  if (signal.aborted) {
    void pdf.loadingTask.destroy()
    return { blobs: [], urls: [] }
  }

  const blobs: Blob[] = []
  const urls: string[] = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      if (signal.aborted) break
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 0.5 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
      }
      if (signal.aborted) break
      await new Promise<void>((resolve) =>
        canvas.toBlob(
          (blob) => {
            if (blob && !signal.aborted) {
              blobs.push(blob)
              urls.push(URL.createObjectURL(blob))
            }
            resolve()
          },
          'image/jpeg',
          0.75
        )
      )
    }
  } finally {
    void pdf.loadingTask.destroy()
  }

  return { blobs, urls }
}

export type PreviewCacheResult = {
  thumbnails: Record<string, string>
  pdfPageThumbs: Record<string, string[]>
}

export function usePreviewCache(playlist: FileItemRecord[]): PreviewCacheResult {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [pdfPageThumbs, setPdfPageThumbs] = useState<Record<string, string[]>>({})
  const thumbUrlsRef = useRef<string[]>([])
  const sourceReleasesRef = useRef<Array<() => void>>([])

  const playlistKey = useMemo(
    () => playlist.map((i) => `${i.id}:${i.mimeType}`).join(','),
    [playlist]
  )

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const semaphore = createSemaphore(3)

    async function preload(): Promise<void> {
      const db = await openFileExplorerDB()
      if (signal.aborted) return

      await Promise.all(
        playlist
          .filter((item) => canPreload(item.mimeType))
          .map(async (item) => {
            const release = await semaphore.acquire()
            try {
              if (signal.aborted) return

              if (item.mimeType === 'application/pdf') {
                const blobId = getBlobId(item)
                const cachedThumbs = await getPdfPageThumbs(blobId)
                if (signal.aborted) {
                  cachedThumbs.forEach((url) => URL.revokeObjectURL(url))
                  return
                }
                if (cachedThumbs.length > 0) {
                  thumbUrlsRef.current.push(...cachedThumbs)
                  setPdfPageThumbs((prev) => ({ ...prev, [item.id]: cachedThumbs }))
                  setThumbnails((prev) => ({ ...prev, [item.id]: cachedThumbs[0] }))
                  return
                }
              }

              const source = await getFileSource(db, getBlobId(item), item.mimeType ?? '')
              if (!source || signal.aborted) {
                source?.revoke()
                return
              }

              if (item.mimeType?.startsWith('image/')) {
                sourceReleasesRef.current.push(source.revoke)
                setThumbnails((prev) => ({ ...prev, [item.id]: source.url }))
              } else if (item.mimeType?.startsWith('video/')) {
                try {
                  const thumbUrl = await captureVideoThumb(source.url, signal)
                  if (!thumbUrl || signal.aborted) return
                  thumbUrlsRef.current.push(thumbUrl)
                  setThumbnails((prev) => ({ ...prev, [item.id]: thumbUrl }))
                } finally {
                  source.revoke()
                }
              } else if (item.mimeType === 'application/pdf') {
                let rendered: RenderedPdfThumbs
                try {
                  rendered = await renderPdfPageThumb(source.url, signal)
                } finally {
                  source.revoke()
                }
                if (signal.aborted) {
                  rendered.urls.forEach((url) => URL.revokeObjectURL(url))
                  return
                }
                await savePdfPageThumbBlobs(getBlobId(item), rendered.blobs)
                if (signal.aborted) {
                  rendered.urls.forEach((url) => URL.revokeObjectURL(url))
                  return
                }
                const thumbs = rendered.urls
                thumbUrlsRef.current.push(...thumbs)
                setPdfPageThumbs((prev) => ({ ...prev, [item.id]: thumbs }))
                if (thumbs.length > 0) {
                  setThumbnails((prev) => ({ ...prev, [item.id]: thumbs[0] }))
                }
              }
            } finally {
              release()
            }
          })
      )
    }

    void preload()

    return () => {
      controller.abort()
      setThumbnails({})
      setPdfPageThumbs({})
      setTimeout(() => {
        sourceReleasesRef.current.forEach((release) => release())
        sourceReleasesRef.current = []
        thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
        thumbUrlsRef.current = []
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistKey])

  return { thumbnails, pdfPageThumbs }
}
