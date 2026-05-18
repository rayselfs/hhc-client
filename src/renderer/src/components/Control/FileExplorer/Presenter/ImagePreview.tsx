import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

interface ImagePreviewProps {
  item: FileItemRecord
}

export default function ImagePreview({ item }: ImagePreviewProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)

  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    setLoading(true)
    setError(false)

    async function load() {
      const db = await openFileExplorerDB()
      const blob = await getFileBlob(db, item.id)
      if (cancelled) return
      if (!blob) {
        setError(true)
        setLoading(false)
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
  }, [item.id])

  useEffect(() => {
    setPanX(0)
    setPanY(0)
  }, [item.id])

  useEffect(() => {
    if (zoomLevel === 1) {
      setPanX(0)
      setPanY(0)
    }
  }, [zoomLevel])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoomLevel <= 1) return
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY, panX, panY }
    },
    [zoomLevel, panX, panY]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      setPanX(dragStart.current.panX + (e.clientX - dragStart.current.x))
      setPanY(dragStart.current.panY + (e.clientY - dragStart.current.y))
    },
    [dragging]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        Loading...
      </div>
    )
  }

  if (error || !imgSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        無法載入圖片
      </div>
    )
  }

  const transform = `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`
  const transition = dragging ? 'none' : 'transform 0.15s ease'
  const cursor = zoomLevel === 1 ? 'default' : dragging ? 'grabbing' : 'grab'

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{ userSelect: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img
        src={imgSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transform,
          transformOrigin: 'center center',
          transition,
          cursor
        }}
        draggable={false}
        alt={item.name}
      />
    </div>
  )
}
