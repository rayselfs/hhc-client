import { useCallback, useEffect, useRef } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import {
  useMediaProjectionStore,
  type MediaProjectionStore
} from '@renderer/stores/media-projection'
import { getBlobId } from '@renderer/lib/blob-identity'
import type { ProjectionPayload } from '@shared/projection-messages'

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
  const projectSequenceRef = useRef(0)

  const projectCurrentItem = useCallback(
    async (state: MediaProjectionStore): Promise<void> => {
      const sequence = ++projectSequenceRef.current
      const item = state.playlist[state.currentIndex]
      if (!item) return
      const snapshotEntry = state.snapshot?.entries.find((entry) => entry.itemId === item.id)
      const blobId = snapshotEntry?.blobId ?? getBlobId(item)
      const payload: ProjectionPayload<'file:show'> = {
        itemId: item.id,
        blobId,
        fileName: item.name,
        mimeType: item.mimeType,
        playlist: state.playlist.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
        currentIndex: state.currentIndex,
        playbackMode: snapshotEntry?.playbackMode,
        seekable: snapshotEntry?.seekable,
        durationMs: snapshotEntry?.durationMs
      }

      if (sequence === projectSequenceRef.current) {
        void project('file:show', payload)
      }
    },
    [project]
  )

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return

      const indexChanged = state.currentIndex !== prev.currentIndex
      const playlistChanged = playlistContentChanged(prev.playlist, state.playlist)
      const endedCleared = prev.isEnded && !state.isEnded

      if (indexChanged || playlistChanged || endedCleared) {
        if (indexChanged) void useMediaProjectionStore.getState().upgradeReadyTranscodedItems()
        void projectCurrentItem(state)
      }
    })
    return () => {
      unsub()
    }
  }, [projectCurrentItem])

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
        projectSequenceRef.current += 1
        blankProjection(true)
      }
    })
    return unsub
  }, [blankProjection])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (state.isEnded && !prev.isEnded) {
        projectSequenceRef.current += 1
        send('file:end', null)
      }
    })
    return unsub
  }, [send])

  useEffect(() => {
    const state = useMediaProjectionStore.getState()
    if (!state.isPresenting) return
    void projectCurrentItem(state)
  }, [projectCurrentItem])
}
