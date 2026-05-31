import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'

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

async function captureVideoThumb(videoBlob: Blob, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(videoBlob)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    const cleanup = (): void => {
      URL.revokeObjectURL(url)
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

    video.src = url
  })
}

async function renderPdfPageThumb(pdfBlob: Blob, signal: AbortSignal): Promise<string[]> {
  const pdfjsLib = await loadPdfjsLib()
  if (signal.aborted) return []

  const buffer = await pdfBlob.arrayBuffer()
  if (signal.aborted) return []

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  if (signal.aborted) {
    pdf.destroy()
    return []
  }

  const thumbUrls: string[] = []
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
              thumbUrls.push(URL.createObjectURL(blob))
            }
            resolve()
          },
          'image/jpeg',
          0.75
        )
      )
    }
  } finally {
    pdf.destroy()
  }

  return thumbUrls
}

export type PreviewCacheResult = {
  thumbnails: Record<string, string>
  pdfPageThumbs: Record<string, string[]>
}

export function usePreviewCache(playlist: FileItemRecord[]): PreviewCacheResult {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [pdfPageThumbs, setPdfPageThumbs] = useState<Record<string, string[]>>({})
  const thumbUrlsRef = useRef<string[]>([])

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
              const blob = await getFileBlob(db, item.id)
              if (!blob || signal.aborted) return

              if (item.mimeType?.startsWith('image/')) {
                const url = URL.createObjectURL(blob)
                thumbUrlsRef.current.push(url)
                if (signal.aborted) {
                  URL.revokeObjectURL(url)
                  return
                }
                setThumbnails((prev) => ({ ...prev, [item.id]: url }))
              } else if (item.mimeType?.startsWith('video/')) {
                const thumbUrl = await captureVideoThumb(blob, signal)
                if (!thumbUrl || signal.aborted) return
                thumbUrlsRef.current.push(thumbUrl)
                setThumbnails((prev) => ({ ...prev, [item.id]: thumbUrl }))
              } else if (item.mimeType === 'application/pdf') {
                const thumbs = await renderPdfPageThumb(blob, signal)
                if (signal.aborted) {
                  thumbs.forEach((u) => URL.revokeObjectURL(u))
                  return
                }
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
        thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
        thumbUrlsRef.current = []
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistKey])

  return { thumbnails, pdfPageThumbs }
}
