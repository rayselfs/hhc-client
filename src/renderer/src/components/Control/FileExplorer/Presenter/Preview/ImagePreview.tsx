import React, { useEffect, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

interface ImagePreviewProps {
  item: FileItemRecord
}

export default function ImagePreview({ item }: ImagePreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(false)
      const db = await openFileExplorerDB()
      const blob = await getFileBlob(db, item.id)
      if (cancelled) return
      if (!blob) {
        setError(true)
        setLoading(false)
        toast.warning(t('fileExplorer.blobLoadFailed'))
        const store = useMediaProjectionStore.getState()
        if (store.canNext()) {
          store.next()
        } else {
          store.exit()
        }
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setImgSrc(objectUrl)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setImgSrc(null)
    }
  }, [item.id, t])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        {t('presenter.loading')}
      </div>
    )
  }

  if (error || !imgSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        {t('presenter.imageLoadFailed')}
      </div>
    )
  }

  if (zoomLevel > 1) {
    const viewportWidth = (1 / zoomLevel) * 100
    const viewportHeight = (1 / zoomLevel) * 100
    const viewportLeft = (0.5 - (0.5 - pan.x) / zoomLevel) * 100
    const viewportTop = (0.5 - (0.5 - pan.y) / zoomLevel) * 100

    return (
      <div className="w-full h-full overflow-hidden relative">
        <img
          src={imgSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          draggable={false}
          alt={item.name}
        />
        <div
          className="absolute border-2 border-accent bg-accent/20 pointer-events-none transition-all duration-100"
          style={{
            left: `${viewportLeft}%`,
            top: `${viewportTop}%`,
            width: `${viewportWidth}%`,
            height: `${viewportHeight}%`
          }}
        />
      </div>
    )
  }

  const transform = `scale(${zoomLevel}) translate(${(pan.x / zoomLevel) * 100}%, ${(pan.y / zoomLevel) * 100}%)`

  return (
    <div className="w-full h-full overflow-hidden">
      <img
        src={imgSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transform,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease',
          cursor: zoomLevel > 1 ? 'grab' : 'default'
        }}
        draggable={false}
        alt={item.name}
      />
    </div>
  )
}
