import React, { useCallback, useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useTimerRuntimeStore } from '@renderer/stores/timer-runtime'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { useMediaProjectionSync } from '@renderer/lib/media-projection-sync'
import { setPresenterActive } from '@renderer/lib/shortcut-registry'
import { getDescriptor } from '@renderer/lib/presenter-registry'
import { PresenterCommandContext } from '@renderer/contexts/PresenterCommandContext'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'
import type { FileControlPayload } from '@shared/projection-messages'
import PresenterHeader from './PresenterHeader'
import PresenterNavigation from './PresenterNavigation'
import PresenterSidebar from './PresenterSidebar'
import PresenterGrid from './PresenterGrid'
import MediaPreview from './Preview/MediaPreview'
import MediaToolbar from './MediaToolbar'
import GlassDivider from '@renderer/components/Common/GlassDivider'

export default function MediaPresenter(): React.JSX.Element {
  const { claimProjection, blankProjection, send } = useProjection()

  useMediaProjectionSync()

  const playlist = useMediaProjectionStore((s) => s.playlist)
  const showGrid = useMediaProjectionStore((s) => s.showGrid)
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const currentItem = useMediaProjectionStore((s) => s.currentItem())

  const { exit, next, prev, jumpTo, toggleGrid, setZoomLevel, resetZoom } =
    useMediaProjectionStore.getState()

  const descriptor = currentItem ? getDescriptor(currentItem.mimeType) : null

  const sendCommand = useCallback(
    (cmd: FileControlPayload) => send('file:control', cmd),
    [send]
  )

  useEffect(() => {
    const timerStatus = useTimerRuntimeStore.getState().status
    if (timerStatus === 'running') {
      useTimerRuntimeStore.getState().pause()
    }
    claimProjection('media', { unblank: true })

    return () => {
      blankProjection(true)
    }
  }, [blankProjection, claimProjection])

  useEffect(() => {
    setPresenterActive(true)
    return () => {
      setPresenterActive(false)
    }
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
      ...(descriptor?.type === 'video'
        ? [
            {
              config: SHORTCUTS.MEDIA.VIDEO_TOGGLE_PLAY,
              handler: () => window.dispatchEvent(new CustomEvent('media:togglePlay'))
            }
          ]
        : []),
      ...(descriptor?.type === 'pdf'
        ? [
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
              handler: () => {
                const currentViewMode =
                  useMediaProjectionStore.getState().typeStates['pdf']?.viewMode ?? 'slide'
                const newMode = currentViewMode === 'slide' ? 'scroll' : 'slide'
                useMediaProjectionStore.getState().setTypeState('pdf', { viewMode: newMode })
                send('file:control', {
                  action: 'pdfViewMode',
                  value: newMode === 'slide' ? 'single' : 'continuous'
                })
              }
            }
          ]
        : [])
    ],
    { sectionKey: 'media' }
  )

  return (
    <PresenterCommandContext.Provider value={{ sendCommand }}>
      <div
        className="media-presenter fixed inset-0 z-9999 bg-surface"
        data-testid="media-presenter"
      >
        <div className="flex h-full">
          <div className="flex-3 lg:flex-2 min-w-0 flex flex-col h-full">
            <PresenterHeader onExit={exit} />
            <MediaPreview currentItem={currentItem} descriptor={descriptor} />
            <MediaToolbar />
            <div className="flex-1" />
            <PresenterNavigation />
          </div>

          <GlassDivider vertical />

          <div className="flex-2 lg:flex-1 min-w-0 h-full">
            <PresenterSidebar />
          </div>
        </div>

        {showGrid && (
          <ShortcutScope name="grid">
            <PresenterGrid />
          </ShortcutScope>
        )}
      </div>
    </PresenterCommandContext.Provider>
  )
}
