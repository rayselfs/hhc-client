import { useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { getBlobId } from '@renderer/lib/blob-identity'

function playlistContentChanged(
  prev: { id: string; mimeType: string; name: string }[],
  next: { id: string; mimeType: string; name: string }[]
): boolean {
  if (prev.length !== next.length) return true
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i]
    const n = next[i]
    if (p.id !== n.id || p.mimeType !== n.mimeType || p.name !== n.name) return true
  }
  return false
}

export function useMediaProjectionSync(): void {
  const { project, send, blankProjection } = useProjection()

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting || state.isRehearsal) return

      const indexChanged = state.currentIndex !== prev.currentIndex
      const playlistChanged = playlistContentChanged(prev.playlist, state.playlist)
      const endedCleared = prev.isEnded && !state.isEnded

      if (indexChanged || playlistChanged || endedCleared) {
        const item = state.playlist[state.currentIndex]
        if (!item) return
        void project('file:show', {
          itemId: item.id,
          blobId: getBlobId(item),
          fileName: item.name,
          mimeType: item.mimeType,
          playlist: state.playlist.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
          currentIndex: state.currentIndex
        })
      }
    })
    return unsub
  }, [project])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting || state.isRehearsal) return
      if (state.pan !== prev.pan) {
        send('file:control', { action: 'pan', value: state.pan })
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting || state.isRehearsal) return
      if (state.zoomLevel !== prev.zoomLevel) {
        send('file:control', { action: 'zoom', value: state.zoomLevel })
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (prev.isPresenting && !prev.isRehearsal && !state.isPresenting) {
        blankProjection(true)
      }
    })
    return unsub
  }, [blankProjection])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting || state.isRehearsal) return
      if (state.isEnded && !prev.isEnded) {
        send('file:end', null)
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const state = useMediaProjectionStore.getState()
    if (!state.isPresenting || state.isRehearsal) return
    const item = state.playlist[state.currentIndex]
    if (!item) return
    void project('file:show', {
      itemId: item.id,
      blobId: getBlobId(item),
      fileName: item.name,
      mimeType: item.mimeType,
      playlist: state.playlist.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
      currentIndex: state.currentIndex
    })
  }, [project])
}
