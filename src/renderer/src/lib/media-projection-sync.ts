import { useCallback, useEffect, useRef } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { usePresentationSessionRegistry } from '@renderer/contexts/PresentationSessionRegistryContext'
import {
  useMediaProjectionStore,
  type MediaProjectionStore
} from '@renderer/stores/media-projection'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import {
  buildEditableProjectionPayloadForSession,
  buildFileProjectionPayload,
  buildFileProjectionPayloadWithEditableSlide
} from '@renderer/lib/media-projection-payload'
import {
  isEditablePresentationMimeType,
  isPresentationMimeType
} from '@renderer/lib/presentation-media'

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
  const { project, startProjection, activeOwner } = useProjection()
  const registry = usePresentationSessionRegistry()
  const projectSequenceRef = useRef(0)
  const didInitializeRef = useRef(false)

  const projectCurrentItem = useCallback(
    async (
      state: MediaProjectionStore,
      startSession = false,
      bringToFront = false
    ): Promise<void> => {
      if (!startSession && activeOwner !== 'media') return
      const sequence = ++projectSequenceRef.current
      const item = state.currentItem()
      const basePayload = buildFileProjectionPayload(state)
      let payload = basePayload
      if (basePayload && item && isEditablePresentationMimeType(item.mimeType)) {
        const session = registry.get(item.id)
        payload = session
          ? await buildEditableProjectionPayloadForSession(
              basePayload,
              session,
              usePresentationWorkspaceStore.getState().getActiveSlideId(item.id) ?? ''
            )
          : await buildFileProjectionPayloadWithEditableSlide(state)
      }
      if (!payload) return

      if (sequence === projectSequenceRef.current) {
        if (startSession) {
          void startProjection('media', [['file:show', payload]], { bringToFront })
        } else {
          void project('file:show', payload, { bringToFront })
        }
      }
    },
    [activeOwner, project, registry, startProjection]
  )

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return

      const started = !prev.isPresenting && state.isPresenting
      if (!started && activeOwner !== 'media') return
      const indexChanged = state.currentIndex !== prev.currentIndex
      const playlistChanged = playlistContentChanged(prev.playlist, state.playlist)
      const endedCleared = prev.isEnded && !state.isEnded
      const presentationChanged =
        isPresentationMimeType(state.currentItem()?.mimeType) &&
        state.typeStates.presentation !== prev.typeStates.presentation

      if (started || indexChanged || playlistChanged || endedCleared || presentationChanged) {
        const explicitContentChange = started || indexChanged || endedCleared || presentationChanged
        void projectCurrentItem(state, started, explicitContentChange).catch(() => undefined)
      }
    })
    return () => {
      unsub()
    }
  }, [activeOwner, projectCurrentItem])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (activeOwner !== 'media') return
      if (state.pan !== prev.pan) {
        void project('file:control', { action: 'pan', value: state.pan })
      }
    })
    return unsub
  }, [activeOwner, project])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (activeOwner !== 'media') return
      if (state.zoomLevel !== prev.zoomLevel) {
        void project('file:control', { action: 'zoom', value: state.zoomLevel })
      }
    })
    return unsub
  }, [activeOwner, project])

  useEffect(() => {
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (!state.isPresenting) return
      if (activeOwner !== 'media') return
      if (state.isEnded && !prev.isEnded) {
        projectSequenceRef.current += 1
        void project('file:end', null)
      }
    })
    return unsub
  }, [activeOwner, project])

  useEffect(() => {
    if (didInitializeRef.current) return
    didInitializeRef.current = true
    const state = useMediaProjectionStore.getState()
    if (!state.isPresenting || activeOwner !== 'media') return
    void projectCurrentItem(state, true, false).catch(() => undefined)
  }, [activeOwner, projectCurrentItem])
}
