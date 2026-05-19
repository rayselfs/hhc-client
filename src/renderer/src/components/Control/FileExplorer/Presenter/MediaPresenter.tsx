import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, ZoomIn, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useTimerRuntimeStore } from '@renderer/stores/timer-runtime'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { getMediaType } from '@renderer/lib/presentability'
import { useMediaProjectionSync } from '@renderer/lib/media-projection-sync'
import { setPresenterActive } from '@renderer/lib/shortcut-registry'
import ImagePreview from './ImagePreview'
import VideoPreview from './VideoPreview'
import PdfPreview from './PdfPreview'
import PresenterHeader from './PresenterHeader'
import PresenterNavigation from './PresenterNavigation'
import PresenterSidebar from './PresenterSidebar'
import PresenterGrid from './PresenterGrid'
import GlassDivider from '@renderer/components/Common/GlassDivider'

const PAN_STEP = 0.05

export default function MediaPresenter(): React.JSX.Element {
  const { t } = useTranslation()
  const { claimProjection, blankProjection } = useProjection()
  const [showZoomInput, setShowZoomInput] = useState(false)
  const [zoomInputValue, setZoomInputValue] = useState('')
  const [hasZoomError, setHasZoomError] = useState(false)

  const previewBoxRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const panDragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0, w: 1, h: 1 })

  useMediaProjectionSync()

  const playlist = useMediaProjectionStore((s) => s.playlist)
  const showGrid = useMediaProjectionStore((s) => s.showGrid)
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)
  const pdfViewMode = useMediaProjectionStore((s) => s.pdfViewMode)
  const currentItem = useMediaProjectionStore((s) => s.currentItem())

  const { exit, next, prev, jumpTo, toggleGrid, setPdfViewMode, setZoomLevel, resetZoom, setPan } =
    useMediaProjectionStore.getState()

  useEffect(() => {
    const timerStatus = useTimerRuntimeStore.getState().status
    if (timerStatus === 'running') {
      useTimerRuntimeStore.getState().pause()
    }
    claimProjection('media', { unblank: true })

    return () => {
      blankProjection(true)
    }
  }, [])

  useEffect(() => {
    setPresenterActive(true)
    return () => {
      setPresenterActive(false)
    }
  }, [])

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
      h: rect?.height ?? 1
    }
  }, [])

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    const { setPan: storePan } = useMediaProjectionStore.getState()
    const d = panDragStart.current
    storePan(d.panX + (e.clientX - d.x) / d.w, d.panY + (e.clientY - d.y) / d.h)
  }, [])

  const handlePanEnd = useCallback(() => {
    isDraggingRef.current = false
    setIsDragging(false)
  }, [])

  useKeyboardShortcuts(
    [
      {
        config: SHORTCUTS.MEDIA.ESCAPE,
        handler: () => {
          if (showGrid) {
            toggleGrid()
          } else if (zoomLevel > 1) {
            resetZoom()
          } else {
            exit()
          }
        }
      },
      { config: SHORTCUTS.MEDIA.NEXT_SLIDE, handler: () => next() },
      { config: SHORTCUTS.MEDIA.NEXT_SLIDE_ALT, handler: () => next() },
      { config: SHORTCUTS.MEDIA.PREV_SLIDE, handler: () => prev() },
      { config: SHORTCUTS.MEDIA.PREV_SLIDE_ALT, handler: () => prev() },
      { config: SHORTCUTS.MEDIA.FIRST_SLIDE, handler: () => jumpTo(0) },
      { config: SHORTCUTS.MEDIA.LAST_SLIDE, handler: () => jumpTo(playlist.length - 1) },
      { config: SHORTCUTS.MEDIA.TOGGLE_GRID, handler: () => toggleGrid() },
      {
        config: SHORTCUTS.MEDIA.TOGGLE_ZOOM,
        handler: () => (zoomLevel > 1 ? resetZoom() : setZoomLevel(1.2))
      },
      {
        config: SHORTCUTS.MEDIA.ZOOM_IN,
        handler: () => setZoomLevel(Math.min(zoomLevel + 0.5, 5))
      },
      {
        config: SHORTCUTS.MEDIA.ZOOM_OUT,
        handler: () => setZoomLevel(Math.max(zoomLevel - 0.5, 1))
      },
      {
        config: SHORTCUTS.MEDIA.VIDEO_TOGGLE_PLAY,
        handler: () => window.dispatchEvent(new CustomEvent('media:togglePlay'))
      },
      {
        config: SHORTCUTS.MEDIA.PDF_NEXT_PAGE,
        handler: () => window.dispatchEvent(new CustomEvent('media:pdfNextPage'))
      },
      {
        config: SHORTCUTS.MEDIA.PDF_PREV_PAGE,
        handler: () => window.dispatchEvent(new CustomEvent('media:pdfPrevPage'))
      },
      {
        config: SHORTCUTS.MEDIA.PDF_TOGGLE_VIEW_MODE,
        handler: () => setPdfViewMode(pdfViewMode === 'slide' ? 'scroll' : 'slide')
      }
    ],
    { sectionKey: 'media' }
  )

  const mediaType = currentItem ? getMediaType(currentItem.mimeType) : null

  return (
    <div
      className="media-presenter"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'black' }}
      data-testid="media-presenter"
    >
      <div className="flex h-full">
        <div className="flex-[3] min-w-0 flex flex-col h-full">
          <PresenterHeader onExit={exit} />

          <div
            ref={previewBoxRef}
            className="relative shrink-0 w-full bg-black overflow-hidden px-4"
            style={{
              userSelect: 'none',
              cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
          >
            <div className="aspect-video w-full overflow-hidden relative">
              {mediaType === 'image' && currentItem && <ImagePreview item={currentItem} />}
              {mediaType === 'video' && currentItem && <VideoPreview item={currentItem} />}
              {mediaType === 'pdf' && currentItem && <PdfPreview item={currentItem} />}
              {!mediaType && (
                <div className="text-white/50 text-center w-full h-full flex items-center justify-center">
                  {t('presenter.noMediaSelected')}
                </div>
              )}

              {zoomLevel > 1 && (
                <div
                  className="absolute bottom-3 right-3 flex flex-col items-center gap-1 backdrop-blur-sm rounded-lg p-2"
                  style={{ background: 'var(--presenter-overlay-bg)' }}
                  onMouseDown={(e) => e.stopPropagation()}
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
                        className="w-12 text-center text-xs text-white bg-transparent border rounded outline-none tabular-nums py-0.5"
                        style={{
                          borderColor: hasZoomError
                            ? 'rgba(248,113,113,0.7)'
                            : 'rgba(255,255,255,0.3)'
                        }}
                      />
                    ) : (
                      <button
                        className="text-white/70 hover:text-white text-xs tabular-nums w-12 text-center p-1 rounded"
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

          <div className="flex items-center gap-0 px-4 py-2 shrink-0">
            <button
              className={`p-4 rounded ${showGrid ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              onClick={() => toggleGrid()}
              aria-label={t('presenter.grid')}
            >
              <LayoutGrid size={36} />
            </button>
            <button
              className={`p-4 rounded ${zoomLevel > 1 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              onClick={() => (zoomLevel > 1 ? resetZoom() : setZoomLevel(1.2))}
              aria-label={t('presenter.zoom')}
            >
              <ZoomIn size={36} />
            </button>
          </div>

          <div className="flex-1" />

          <PresenterNavigation />
        </div>

        <GlassDivider vertical />

        <div className="flex-[2] min-w-0 h-full">
          <PresenterSidebar />
        </div>
      </div>

      {showGrid && <PresenterGrid />}
    </div>
  )
}
