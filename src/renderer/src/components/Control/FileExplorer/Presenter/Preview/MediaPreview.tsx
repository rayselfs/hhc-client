import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FileItemRecord } from '@shared/types/folder'
import type { MediaTypeDescriptor } from '@renderer/lib/presenter-registry'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const PAN_STEP = 0.05

interface MediaPreviewProps {
  currentItem: FileItemRecord | null
  descriptor: MediaTypeDescriptor | null
}

export default function MediaPreview({
  currentItem,
  descriptor
}: MediaPreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const panDragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0, w: 1, h: 1, zoom: 1 })
  const [showZoomInput, setShowZoomInput] = useState(false)
  const [zoomInputValue, setZoomInputValue] = useState('')
  const [hasZoomError, setHasZoomError] = useState(false)

  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)
  const { next, setPan, setZoomLevel } = useMediaProjectionStore.getState()

  useEffect(() => {
    if (zoomLevel <= 1) {
      setShowZoomInput(false)
      setHasZoomError(false)
    }
  }, [zoomLevel])

  useEffect(() => {
    const el = previewBoxRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const { zoomLevel: currentZoom } = useMediaProjectionStore.getState()
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      useMediaProjectionStore.getState().setZoomLevel(Math.max(1, Math.min(5, currentZoom + delta)))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const { zoomLevel: currentZoom, pan: currentPan } = useMediaProjectionStore.getState()
    if (currentZoom <= 1) return
    isDraggingRef.current = true
    setIsDragging(true)
    const rect = previewBoxRef.current?.getBoundingClientRect()
    panDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: currentPan.x,
      panY: currentPan.y,
      w: rect?.width ?? 1,
      h: rect?.height ?? 1,
      zoom: currentZoom
    }

    const onMove = (ev: MouseEvent): void => {
      if (!isDraggingRef.current) return
      const { setPan: storePan } = useMediaProjectionStore.getState()
      const d = panDragStart.current
      storePan(
        d.panX - ((ev.clientX - d.x) / d.w) * d.zoom,
        d.panY - ((ev.clientY - d.y) / d.h) * d.zoom
      )
    }

    const onUp = (): void => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const PreviewComponent = descriptor?.PreviewComponent ?? null

  return (
    <div
      ref={previewBoxRef}
      className="relative shrink-0 w-full overflow-hidden px-4"
      style={{
        userSelect: 'none',
        cursor: zoomLevel > 1
          ? isDragging
            ? 'grabbing'
            : 'grab'
          : descriptor?.clickToAdvance
            ? 'pointer'
            : 'default'
      }}
      onMouseDown={handlePanStart}
    >
      <div
        className="aspect-video w-full overflow-hidden relative rounded-2xl bg-surface-secondary border border-default-300"
        onClick={() => {
          if (descriptor?.clickToAdvance && zoomLevel <= 1) next()
        }}
      >
        {PreviewComponent && currentItem ? (
          <PreviewComponent item={currentItem} />
        ) : (
          <div className="text-foreground/50 text-center w-full h-full flex items-center justify-center">
            {t('presenter.noMediaSelected')}
          </div>
        )}

        {zoomLevel > 1 && (
          <div
            className="absolute bottom-3 right-3 flex flex-col items-center gap-1 rounded-lg p-2 presenter-media-control"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="text-white/70 hover:text-white p-1 rounded"
              onClick={() => setPan(pan.x, pan.y - PAN_STEP)}
            >
              <ArrowUp size={16} />
            </button>
            <div className="flex items-center gap-1">
              <button
                className="text-white/70 hover:text-white p-1 rounded"
                onClick={() => setPan(pan.x - PAN_STEP, pan.y)}
              >
                <ArrowLeft size={16} />
              </button>
              {showZoomInput ? (
                <input
                  type="text"
                  autoFocus
                  value={zoomInputValue}
                  onChange={(e) => {
                    setZoomInputValue(e.target.value)
                    setHasZoomError(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseFloat(zoomInputValue)
                      if (!isFinite(val) || val < 100 || val > 500) {
                        setHasZoomError(true)
                        return
                      }
                      setZoomLevel(val / 100)
                      setShowZoomInput(false)
                      setHasZoomError(false)
                    } else if (e.key === 'Escape') {
                      e.stopPropagation()
                      setShowZoomInput(false)
                      setHasZoomError(false)
                    }
                  }}
                  onBlur={() => {
                    setShowZoomInput(false)
                    setHasZoomError(false)
                  }}
                  className="w-12 text-center text-sm text-white bg-transparent border border-white/30 rounded outline-none tabular-nums py-0.5"
                  style={{
                    borderColor: hasZoomError ? 'rgba(248,113,113,0.7)' : undefined
                  }}
                />
              ) : (
                <button
                  className="text-white/70 hover:text-white text-sm tabular-nums w-12 text-center p-1 rounded"
                  onClick={() => {
                    setZoomInputValue(String(Math.round(zoomLevel * 100)))
                    setShowZoomInput(true)
                    setHasZoomError(false)
                  }}
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
              )}
              <button
                className="text-white/70 hover:text-white p-1 rounded"
                onClick={() => setPan(pan.x + PAN_STEP, pan.y)}
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <button
              className="text-white/70 hover:text-white p-1 rounded"
              onClick={() => setPan(pan.x, pan.y + PAN_STEP)}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
