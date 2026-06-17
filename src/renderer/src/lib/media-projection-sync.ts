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
  const liveSessionIdRef = useRef<string | null>(null)
  const projectSequenceRef = useRef(0)

  const stopLiveSession = useCallback((): Promise<void> | undefined => {
    const sessionId = liveSessionIdRef.current
    if (!sessionId) return undefined
    liveSessionIdRef.current = null
    return window.api.videoTranscode.stopLive(sessionId).catch(() => undefined)
  }, [])

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
        seekable: snapshotEntry?.seekable
      }

      if (snapshotEntry?.playbackMode === 'live-transcode') {
        const live = await window.api.videoTranscode.startLive({ sourceFileId: blobId })
        if (sequence !== projectSequenceRef.current) {
          await window.api.videoTranscode.stopLive(live.sessionId).catch(() => undefined)
          return
        }
        await stopLiveSession()
        liveSessionIdRef.current = live.sessionId
        payload.streamUrl = live.url
        payload.mimeType = live.mimeType
        payload.seekable = false
      } else {
        const stopped = stopLiveSession()
        if (stopped) await stopped
      }

      if (sequence === projectSequenceRef.current) {
        void project('file:show', payload)
      }
    },
    [project, stopLiveSession]
  )

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting || state.isRehearsal) return

      const indexChanged = state.currentIndex !== prev.currentIndex
      const playlistChanged = playlistContentChanged(prev.playlist, state.playlist)
      const endedCleared = prev.isEnded && !state.isEnded

      if (indexChanged || playlistChanged || endedCleared) {
        void projectCurrentItem(state)
      }
    })
    return () => {
      unsub()
      void stopLiveSession()
    }
  }, [projectCurrentItem, stopLiveSession])

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
        projectSequenceRef.current += 1
        void stopLiveSession()
        blankProjection(true)
      }
    })
    return unsub
  }, [blankProjection, stopLiveSession])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting || state.isRehearsal) return
      if (state.isEnded && !prev.isEnded) {
        projectSequenceRef.current += 1
        void stopLiveSession()
        send('file:end', null)
      }
    })
    return unsub
  }, [send, stopLiveSession])

  useEffect(() => {
    const state = useMediaProjectionStore.getState()
    if (!state.isPresenting || state.isRehearsal) return
    void projectCurrentItem(state)
  }, [projectCurrentItem])
}
