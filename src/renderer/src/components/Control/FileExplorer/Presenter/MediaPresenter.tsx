import React, { useCallback, useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useTimerRuntimeStore } from '@renderer/stores/timer-runtime'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { setPresenterActive } from '@renderer/lib/shortcut-registry'
import { getDescriptor } from '@renderer/lib/presenter-registry'
import { PresenterCommandContext } from '@renderer/contexts/PresenterCommandContext'
import { PreviewCacheProvider } from '@renderer/contexts/PreviewCacheContext'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'
import type { FileControlPayload } from '@shared/projection-messages'
import PresenterHeader from './PresenterHeader'
import PresenterNavigation from './PresenterNavigation'
import PresenterSidebar from './PresenterSidebar'
import PresenterGrid from './PresenterGrid'
import MediaPreview from './Preview/MediaPreview'
import MediaToolbar from './MediaToolbar'
import {
  NavigatorRail,
  ResponsivePanelGroup,
  StageViewport,
  WorkspaceShell
} from '@renderer/components/Common/WorkspacePrimitives'
import { usePreviewCache } from '@renderer/hooks/usePreviewCache'
import { useThumbnails } from '@renderer/hooks/useThumbnails'

interface MediaPresenterProps {
  onExit: () => void
}

export default function MediaPresenter({ onExit }: MediaPresenterProps): React.JSX.Element {
  const { project } = useProjection()

  const playlist = useMediaProjectionStore((s) => s.playlist)
  const { pdfPageThumbs } = usePreviewCache(playlist)
  const coverThumbnails = useThumbnails(playlist)
  const showGrid = useMediaProjectionStore((s) => s.showGrid)
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const isEnded = useMediaProjectionStore((s) => s.isEnded)
  const currentItem = useMediaProjectionStore((s) => s.currentItem())

  const { next, prev, jumpTo, toggleGrid, setZoomLevel, resetZoom } =
    useMediaProjectionStore.getState()

  const descriptor = currentItem ? getDescriptor(currentItem.mimeType) : null

  const sendCommand = useCallback(
    (cmd: FileControlPayload) => {
      void project('file:control', cmd)
    },
    [project]
  )

  const getCurrentKeyboardVideoState = useCallback(() => {
    const state = useMediaProjectionStore.getState()
    const item = state.currentItem()
    const itemDescriptor = item ? getDescriptor(item.mimeType) : null
    return {
      isVideo: itemDescriptor?.type === 'video',
      videoState: state.typeStates.video
    }
  }, [])

  const pauseCurrentVideoIfPlaying = useCallback((): void => {
    const { isVideo, videoState } = getCurrentKeyboardVideoState()
    if (isVideo && videoState?.isPlaying) {
      window.dispatchEvent(new CustomEvent('media:pauseVideo'))
    }
  }, [getCurrentKeyboardVideoState])

  const toggleGridWithMediaPause = useCallback((): void => {
    if (!useMediaProjectionStore.getState().showGrid) {
      pauseCurrentVideoIfPlaying()
    }
    toggleGrid()
  }, [pauseCurrentVideoIfPlaying, toggleGrid])

  useEffect(() => {
    const timerStatus = useTimerRuntimeStore.getState().status
    if (timerStatus === 'running') {
      useTimerRuntimeStore.getState().pause()
    }
  }, [])

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
          const { isVideo, videoState } = getCurrentKeyboardVideoState()
          if (isVideo && videoState?.isPlaying) {
            window.dispatchEvent(new CustomEvent('media:pauseVideo'))
          } else if (showGrid) {
            toggleGrid()
          } else if (zoomLevel > 1) {
            resetZoom()
          } else {
            onExit()
          }
        }
      },
      {
        config: SHORTCUTS.MEDIA.NEXT_SLIDE,
        handler: () => {
          next()
        }
      },
      { config: SHORTCUTS.MEDIA.NEXT_SLIDE_ALT, handler: () => next() },
      {
        config: SHORTCUTS.MEDIA.PREV_SLIDE,
        handler: () => {
          prev()
        }
      },
      { config: SHORTCUTS.MEDIA.PREV_SLIDE_ALT, handler: () => prev() },
      { config: SHORTCUTS.MEDIA.FIRST_SLIDE, handler: () => jumpTo(0) },
      { config: SHORTCUTS.MEDIA.LAST_SLIDE, handler: () => jumpTo(playlist.length - 1) },
      { config: SHORTCUTS.MEDIA.TOGGLE_GRID, handler: toggleGridWithMediaPause },
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
            },
            {
              config: SHORTCUTS.MEDIA.VIDEO_SEEK_FORWARD,
              handler: () => {
                const { videoState } = getCurrentKeyboardVideoState()
                if (!videoState?.hasStarted || videoState.isEnded) return
                window.dispatchEvent(
                  new CustomEvent('media:videoSeekRelative', { detail: { seconds: 5 } })
                )
              }
            },
            {
              config: SHORTCUTS.MEDIA.VIDEO_SEEK_BACKWARD,
              handler: () => {
                const { videoState } = getCurrentKeyboardVideoState()
                if (!videoState?.hasStarted || videoState.isEnded) return
                window.dispatchEvent(
                  new CustomEvent('media:videoSeekRelative', { detail: { seconds: -5 } })
                )
              }
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
                void project('file:control', {
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
      <PreviewCacheProvider pdfPageThumbs={pdfPageThumbs}>
        <WorkspaceShell className="media-presenter bg-surface" data-testid="media-presenter">
          <ResponsivePanelGroup
            navigatorWidth={360}
            navigatorLabel="Playlist"
            navigator={
              <NavigatorRail className="h-full border-r border-divider">
                <PresenterSidebar previewCache={coverThumbnails} />
              </NavigatorRail>
            }
            stage={
              <StageViewport className="h-full">
                <PresenterHeader onExit={onExit} />
                <MediaPreview
                  currentItem={currentItem}
                  descriptor={descriptor}
                  isEnded={isEnded}
                  onExit={onExit}
                />
                <MediaToolbar onToggleGrid={toggleGridWithMediaPause} />
                <div className="flex-1" />
                <PresenterNavigation />
              </StageViewport>
            }
          />

          {showGrid && (
            <ShortcutScope name="grid">
              <PresenterGrid previewCache={coverThumbnails} />
            </ShortcutScope>
          )}
        </WorkspaceShell>
      </PreviewCacheProvider>
    </PresenterCommandContext.Provider>
  )
}
