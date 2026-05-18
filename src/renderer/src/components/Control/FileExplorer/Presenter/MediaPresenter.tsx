import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useTimerRuntimeStore } from '@renderer/stores/timer-runtime'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { getMediaType } from '@renderer/lib/presentability'
import { useMediaProjectionSync } from '@renderer/lib/media-projection-sync'
import ImagePreview from './ImagePreview'
import VideoPreview from './VideoPreview'
import PdfPreview from './PdfPreview'
import PresenterNavigation from './PresenterNavigation'
import PresenterSidebar from './PresenterSidebar'
import PresenterGrid from './PresenterGrid'

export default function MediaPresenter() {
  const { t } = useTranslation()
  const { claimProjection, blankProjection } = useProjection()
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString())

  useMediaProjectionSync()

  const playlist = useMediaProjectionStore((s) => s.playlist)
  const showGrid = useMediaProjectionStore((s) => s.showGrid)
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pdfViewMode = useMediaProjectionStore((s) => s.pdfViewMode)
  const currentItem = useMediaProjectionStore((s) => s.currentItem())

  const {
    exit,
    next,
    prev,
    jumpTo,
    toggleGrid,
    setPdfViewMode,
    setZoomLevel,
    resetZoom
  } = useMediaProjectionStore.getState()

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
    const interval = setInterval(() => {
      setClock(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useKeyboardShortcuts([
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
      handler: () => (zoomLevel > 1 ? resetZoom() : setZoomLevel(2))
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
  ])

  const mediaType = currentItem ? getMediaType(currentItem.mimeType) : null

  return (
    <div
      className="media-presenter"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'black' }}
      data-testid="media-presenter"
    >
      <div className="grid grid-cols-12 h-full">
        {/* Left: 8 cols */}
        <div className="col-span-8 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-white/70 text-sm font-mono">{clock}</span>
            <button
              className="text-white/70 hover:text-white text-xl leading-none px-2"
              onClick={() => exit()}
            >
              ✕
            </button>
          </div>

          {/* Preview container */}
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
            <div className="aspect-video w-full max-h-full overflow-hidden">
              {mediaType === 'image' && currentItem && (
                <ImagePreview item={currentItem} />
              )}
              {mediaType === 'video' && currentItem && (
                <VideoPreview item={currentItem} />
              )}
              {mediaType === 'pdf' && currentItem && (
                <PdfPreview item={currentItem} />
              )}
              {!mediaType && (
                <div className="text-white/50 text-center w-full h-full flex items-center justify-center">
                  {t('presenter.noMediaSelected')}
                </div>
              )}
            </div>
          </div>

          {/* Control bar */}
          <div className="flex items-center gap-4 px-4 py-2">
            <button
              className={`text-sm px-2 py-1 rounded ${showGrid ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              onClick={() => toggleGrid()}
            >
              G {t('presenter.grid')}
            </button>
            <button
              className={`text-sm px-2 py-1 rounded ${zoomLevel > 1 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              onClick={() => (zoomLevel > 1 ? resetZoom() : setZoomLevel(2))}
            >
              Z {t('presenter.zoom')}
            </button>
            {zoomLevel > 1 && (
              <span className="text-white/70 text-sm">{zoomLevel}x</span>
            )}
          </div>

          {/* Navigation */}
          <PresenterNavigation />
        </div>

        {/* Right: 4 cols */}
        <div className="col-span-4 h-full">
          <PresenterSidebar />
        </div>
      </div>

      {/* Grid overlay */}
      {showGrid && <PresenterGrid />}
    </div>
  )
}
