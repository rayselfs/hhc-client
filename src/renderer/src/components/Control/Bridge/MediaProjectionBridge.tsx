import { useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useMediaProjectionSync } from '@renderer/lib/media-projection-sync'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export default function MediaProjectionBridge(): null {
  const { on } = useProjection()

  useMediaProjectionSync()

  useEffect(() => {
    return on('file:playback-state', (data) => {
      const state = useMediaProjectionStore.getState()
      if (state.currentItem()?.id !== data.itemId) return
      const current = state.typeStates.video
      state.setTypeState('video', {
        hasStarted: current?.hasStarted ?? (data.currentTime > 0 || data.isPlaying),
        isPlaying: data.isPlaying,
        isEnded: data.isEnded,
        currentTime: data.currentTime,
        duration: data.duration
      })
    })
  }, [on])

  return null
}
