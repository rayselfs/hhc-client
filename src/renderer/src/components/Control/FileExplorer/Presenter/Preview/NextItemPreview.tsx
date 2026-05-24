import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItemRecord } from '@shared/types/folder'
import { getMediaType } from '@renderer/lib/presentability'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'
import { useThumbnails } from '@renderer/hooks/useThumbnails'

function NextImagePreview({ item }: { item: FileItemRecord }): React.JSX.Element {
  const { t } = useTranslation()
  const thumbnails = useThumbnails([item])
  const thumbnailUrl = thumbnails[item.id] ?? null
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (thumbnailUrl !== null) return

    let objectUrl: string | null = null
    let cancelled = false

    async function load(): Promise<void> {
      const db = await openFileExplorerDB()
      const blob = await getFileBlob(db, item.id)
      if (cancelled) return
      if (!blob) {
        setError(true)
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, thumbnailUrl])

  if (thumbnailUrl !== null) {
    return (
      <img src={thumbnailUrl} alt={item.name} className="absolute inset-0 w-full h-full object-contain" />
    )
  }

  if (error)
    return (
      <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
        {t('presenter.imageLoadFailed')}
      </span>
    )

  if (!src)
    return (
      <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
        {t('presenter.loading')}
      </span>
    )

  return <img src={src} alt={item.name} className="absolute inset-0 w-full h-full object-contain" />
}

function NextVideoPreview({ item }: { item: FileItemRecord }): React.JSX.Element {
  const { t } = useTranslation()
  const thumbnails = useThumbnails([item])
  const thumbnailUrl = thumbnails[item.id] ?? null
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (thumbnailUrl !== null) return

    let objectUrl: string | null = null
    let cancelled = false

    async function load(): Promise<void> {
      const db = await openFileExplorerDB()
      const blob = await getFileBlob(db, item.id)
      if (cancelled) return
      if (!blob) {
        setError(true)
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, thumbnailUrl])

  if (thumbnailUrl !== null) {
    return (
      <img src={thumbnailUrl} alt={item.name} className="absolute inset-0 w-full h-full object-contain" />
    )
  }

  if (error)
    return (
      <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
        {t('presenter.videoLoadFailed')}
      </span>
    )

  if (!src)
    return (
      <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
        {t('presenter.loading')}
      </span>
    )

  return (
    <video
      src={src}
      className="absolute inset-0 w-full h-full object-contain"
      muted
      playsInline
      preload="metadata"
      onLoadedData={(e) => {
        e.currentTarget.currentTime = 0.1
      }}
    />
  )
}

function NextPdfPreview({ item }: { item: FileItemRecord }): React.JSX.Element {
  const { t } = useTranslation()
  const thumbnails = useThumbnails([item])
  const thumbnailUrl = thumbnails[item.id] ?? null
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (thumbnailUrl !== null) {
      setLoading(false)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    async function load(): Promise<void> {
      setLoading(true)
      setError(false)

      try {
        const db = await openFileExplorerDB()
        const blob = await getFileBlob(db, item.id)
        if (cancelled || !blob) {
          if (!cancelled) setError(true)
          return
        }

        objectUrl = URL.createObjectURL(blob)
        const pdfjsLib = await loadPdfjsLib()
        const pdf = await pdfjsLib.getDocument(objectUrl).promise
        if (cancelled) {
          pdf.destroy()
          return
        }

        const page = await pdf.getPage(1)
        const canvas = canvasRef.current
        if (cancelled || !canvas) {
          pdf.destroy()
          return
        }

        const viewport = page.getViewport({ scale: 1.5 })
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          pdf.destroy()
          return
        }

        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        pdf.destroy()

        if (!cancelled) setLoading(false)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, thumbnailUrl])

  if (thumbnailUrl !== null) {
    return (
      <img src={thumbnailUrl} alt={item.name} className="absolute inset-0 w-full h-full object-contain" />
    )
  }

  return (
    <>
      {(loading || error) && (
        <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
          {error ? t('presenter.pdfLoadFailed') : t('presenter.loading')}
        </span>
      )}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: loading || error ? 0 : 1 }}
      >
        <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </div>
    </>
  )
}

interface NextItemPreviewProps {
  item: FileItemRecord
}

export default function NextItemPreview({ item }: NextItemPreviewProps): React.JSX.Element | null {
  const mediaType = getMediaType(item.mimeType)

  let content: React.JSX.Element | null = null
  if (mediaType === 'image') content = <NextImagePreview item={item} />
  else if (mediaType === 'video') content = <NextVideoPreview item={item} />
  else if (mediaType === 'pdf') content = <NextPdfPreview item={item} />

  if (!content) return null

  return (
    <>
      {content}
      <div className="absolute bottom-1 inset-x-0 flex justify-center px-3 pointer-events-none">
        <span>{item.name}</span>
      </div>
    </>
  )
}
