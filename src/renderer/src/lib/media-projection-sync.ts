import { useEffect, useRef } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export function useMediaProjectionSync(): void {
  const { send, blankProjection } = useProjection()
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSeekRef = useRef(0)

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return

      const indexChanged = state.currentIndex !== prev.currentIndex
      const playlistChanged = state.playlist !== prev.playlist

      if (indexChanged || playlistChanged) {
        const item = state.playlist[state.currentIndex]
        if (!item) return
        send('file:show', {
          fileId: item.id,
          fileName: item.name,
          mimeType: item.mimeType,
          playlist: state.playlist.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
          currentIndex: state.currentIndex
        })
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (state.pdfViewMode !== prev.pdfViewMode) {
        const viewModeValue = state.pdfViewMode === 'slide' ? 'single' : 'continuous'
        send('file:control', { action: 'pdfViewMode', value: viewModeValue })
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (state.pan !== prev.pan) {
        send('file:control', { action: 'pan', value: state.pan })
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (state.zoomLevel !== prev.zoomLevel) {
        send('file:control', { action: 'zoom', value: state.zoomLevel })
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (prev.isPresenting && !state.isPresenting) {
        blankProjection(true)
      }
    })
    return unsub
  }, [blankProjection])

  useEffect(() => {
    const onPlay = (): void => {
      send('file:control', { action: 'play' })
    }
    const onPause = (): void => {
      send('file:control', { action: 'pause' })
    }
    window.addEventListener('media:play', onPlay)
    window.addEventListener('media:pause', onPause)
    return () => {
      window.removeEventListener('media:play', onPlay)
      window.removeEventListener('media:pause', onPause)
    }
  }, [send])

  useEffect(() => {
    let volumeTimer: ReturnType<typeof setTimeout> | null = null
    const onVolumeChange = (e: Event): void => {
      const detail = (e as CustomEvent<{ volume: number }>).detail
      if (!detail) return
      if (volumeTimer) clearTimeout(volumeTimer)
      volumeTimer = setTimeout(() => {
        send('file:control', { action: 'volume', value: detail.volume })
      }, 100)
    }
    window.addEventListener('media:volumeChange', onVolumeChange)
    return () => {
      window.removeEventListener('media:volumeChange', onVolumeChange)
      if (volumeTimer) clearTimeout(volumeTimer)
    }
  }, [send])

  useEffect(() => {
    const onPageChanged = (e: Event): void => {
      const detail = (e as CustomEvent<{ page: number }>).detail
      if (!detail || typeof detail.page !== 'number') return
      send('file:control', { action: 'pdfPage', value: detail.page })
    }

    window.addEventListener('media:pdfPageChanged', onPageChanged)
    return () => {
      window.removeEventListener('media:pdfPageChanged', onPageChanged)
    }
  }, [send])

  useEffect(() => {
    const onSeek = (e: Event): void => {
      const detail = (e as CustomEvent<{ time: number }>).detail
      if (!detail) return

      const now = Date.now()
      if (now - lastSeekRef.current < 200) {
        if (seekTimerRef.current) clearTimeout(seekTimerRef.current)
        seekTimerRef.current = setTimeout(
          () => {
            lastSeekRef.current = Date.now()
            send('file:control', { action: 'seek', value: detail.time })
          },
          200 - (now - lastSeekRef.current)
        )
        return
      }

      lastSeekRef.current = now
      send('file:control', { action: 'seek', value: detail.time })
    }

    window.addEventListener('media:seek', onSeek)
    return () => {
      window.removeEventListener('media:seek', onSeek)
      if (seekTimerRef.current) clearTimeout(seekTimerRef.current)
    }
  }, [send])

  useEffect(() => {
    const state = useMediaProjectionStore.getState()
    if (!state.isPresenting) return
    const item = state.playlist[state.currentIndex]
    if (!item) return
    send('file:show', {
      fileId: item.id,
      fileName: item.name,
      mimeType: item.mimeType,
      playlist: state.playlist.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
      currentIndex: state.currentIndex
    })
  }, [send])
}
