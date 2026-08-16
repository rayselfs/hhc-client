import { useCallback, useEffect, useRef } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { usePresentationSessionRegistry } from '@renderer/contexts/PresentationSessionRegistryContext'
import {
  useMediaProjectionStore,
  type MediaProjectionStore
} from '@renderer/stores/media-projection'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import { isElectron } from '@renderer/lib/env'
import type { HhcLineCloudAuth } from '@renderer/lib/cloud-provider'
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

export interface HhcProjectionAccessRevoked {
  providerConnectionId: string
  remoteItemId: string
}

interface MediaProjectionSyncOptions {
  auth?: HhcLineCloudAuth
  onAccessRevoked?: (scope: HhcProjectionAccessRevoked) => void
}

const RENEWAL_LEAD_MS = 30_000
const RENEWAL_RETRY_MS = 5_000

export function useMediaProjectionSync(options: MediaProjectionSyncOptions = {}): void {
  const { project, startProjection, stopProjection, activeOwner } = useProjection()
  const registry = usePresentationSessionRegistry()
  const projectSequenceRef = useRef(0)
  const didInitializeRef = useRef(false)
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectCurrentItemRef = useRef<
    (
      state: MediaProjectionStore,
      startSession?: boolean,
      bringToFront?: boolean,
      forceRemoteSource?: boolean
    ) => Promise<void>
  >(async () => undefined)
  const activeRemoteRef = useRef<{
    itemId: string
    providerConnectionId: string
    remoteItemId: string
    leaseId?: string
  } | null>(null)
  const { auth, onAccessRevoked } = options
  const sessionUserId = auth?.getSession()?.userId ?? null

  const releaseLease = useCallback((leaseId: string): void => {
    const release = window.api?.hhcAssets?.releaseContentLease
    if (!release) return
    void release(leaseId).catch(() => release(leaseId).catch(() => undefined))
  }, [])

  const clearRemoteSource = useCallback((): void => {
    if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current)
    renewalTimerRef.current = null
    const active = activeRemoteRef.current
    const leaseId = active?.leaseId
    activeRemoteRef.current = null
    if (active) {
      useMediaProjectionStore.setState((state) => {
        const snapshot = state.snapshot
        const item = state.playlist.find((candidate) => candidate.id === active.itemId)
        if (!snapshot || !item) return state
        return {
          snapshot: {
            ...snapshot,
            entries: snapshot.entries.map((entry) => {
              if (entry.itemId !== active.itemId) return entry
              const { remoteSource: _remoteSource, ...rest } = entry
              return { ...rest, sourceUrl: item.url }
            })
          }
        }
      })
    }
    if (leaseId) releaseLease(leaseId)
  }, [releaseLease])

  const projectCurrentItem = useCallback(
    async (
      state: MediaProjectionStore,
      startSession = false,
      bringToFront = false,
      forceRemoteSource = false
    ): Promise<void> => {
      if (!startSession && activeOwner !== 'media') return
      const sequence = ++projectSequenceRef.current
      const item = state.currentItem()
      let currentState = state
      const snapshotEntry = state.snapshot?.entries.find((entry) => entry.itemId === item?.id)
      if (item && auth && snapshotEntry?.remoteItem) {
        try {
          if (snapshotEntry.playbackMode === 'vlc-embedded' && isElectron()) {
            const { ensureHhcLineDesktopItemAvailableForPresentation } =
              await import('@renderer/lib/hhc-line-connect')
            const available = await ensureHhcLineDesktopItemAvailableForPresentation(auth, item)
            if (available === false) return
          } else if (forceRemoteSource || !snapshotEntry.remoteSource) {
            const { prepareHhcLinePresentationSource } =
              await import('@renderer/lib/hhc-line-connect')
            const prepared = await prepareHhcLinePresentationSource(auth, item)
            if (prepared && sequence !== projectSequenceRef.current) {
              if (prepared.source.kind === 'native-lease') releaseLease(prepared.source.leaseId)
              return
            }
            if (!prepared && activeRemoteRef.current?.itemId === item.id) {
              clearRemoteSource()
              currentState = useMediaProjectionStore.getState()
            }
            if (prepared && sequence === projectSequenceRef.current) {
              const previous = activeRemoteRef.current
              const leaseId =
                prepared.source.kind === 'native-lease' ? prepared.source.leaseId : undefined
              if (previous?.leaseId && previous.leaseId !== leaseId) {
                releaseLease(previous.leaseId)
              }
              const remoteSource = {
                providerConnectionId: prepared.providerConnectionId,
                remoteItemId: prepared.remoteItemId,
                rootRemoteFolderId: prepared.rootRemoteFolderId,
                ...(leaseId ? { leaseId } : {}),
                ...(prepared.source.kind === 'ticket'
                  ? { expiresAt: prepared.source.expiresAt }
                  : {}),
                etag: prepared.source.etag
              }
              useMediaProjectionStore.setState((latest) => ({
                snapshot: latest.snapshot
                  ? {
                      ...latest.snapshot,
                      entries: latest.snapshot.entries.map((entry) =>
                        entry.itemId === item.id
                          ? { ...entry, sourceUrl: prepared.source.url, remoteSource }
                          : entry
                      )
                    }
                  : null
              }))
              activeRemoteRef.current = {
                itemId: item.id,
                providerConnectionId: prepared.providerConnectionId,
                remoteItemId: prepared.remoteItemId,
                ...(leaseId ? { leaseId } : {})
              }
              if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current)
              renewalTimerRef.current = null
              if (prepared.source.kind === 'ticket') {
                const delay = Math.max(
                  1_000,
                  prepared.source.expiresAt - Date.now() - RENEWAL_LEAD_MS
                )
                renewalTimerRef.current = setTimeout(() => {
                  void projectCurrentItemRef
                    .current(useMediaProjectionStore.getState(), false, false, true)
                    .catch(() => undefined)
                }, delay)
              }
              currentState = useMediaProjectionStore.getState()
            }
          }
        } catch (error) {
          if (sequence !== projectSequenceRef.current) return
          const classified = error as {
            classification?: string
            status?: number
            providerConnectionId?: string
            remoteItemId?: string
          }
          if (
            classified.classification === 'access-revoked' &&
            classified.status === 403 &&
            classified.providerConnectionId &&
            classified.remoteItemId
          ) {
            onAccessRevoked?.({
              providerConnectionId: classified.providerConnectionId,
              remoteItemId: classified.remoteItemId
            })
          } else if (classified.classification === 'retryable' && snapshotEntry.remoteSource) {
            if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current)
            renewalTimerRef.current = setTimeout(() => {
              void projectCurrentItemRef
                .current(useMediaProjectionStore.getState(), false, false, true)
                .catch(() => undefined)
            }, RENEWAL_RETRY_MS)
          }
          return
        }
      }
      const basePayload = buildFileProjectionPayload(currentState)
      let payload = basePayload
      if (basePayload && item && isEditablePresentationMimeType(item.mimeType)) {
        const session = registry.get(item.id)
        payload = session
          ? await buildEditableProjectionPayloadForSession(
              basePayload,
              session,
              usePresentationWorkspaceStore.getState().getActiveSlideId(item.id) ?? ''
            )
          : await buildFileProjectionPayloadWithEditableSlide(currentState)
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
    [
      activeOwner,
      auth,
      clearRemoteSource,
      onAccessRevoked,
      project,
      registry,
      releaseLease,
      startProjection
    ]
  )

  useEffect(() => {
    projectCurrentItemRef.current = projectCurrentItem
  }, [projectCurrentItem])

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
        if (indexChanged || playlistChanged) clearRemoteSource()
        const explicitContentChange = started || indexChanged || endedCleared || presentationChanged
        void projectCurrentItem(state, started, explicitContentChange).catch(() => undefined)
      }
    })
    return () => {
      unsub()
    }
  }, [activeOwner, clearRemoteSource, projectCurrentItem])

  useEffect(() => {
    if (!useMediaProjectionStore.getState().isPresenting) clearRemoteSource()
    const unsub = useMediaProjectionStore.subscribe((state, prev) => {
      if (prev.isPresenting && !state.isPresenting) {
        projectSequenceRef.current += 1
        clearRemoteSource()
      }
    })
    return unsub
  }, [clearRemoteSource])

  const previousSessionUserIdRef = useRef(sessionUserId)
  useEffect(() => {
    const previousUserId = previousSessionUserIdRef.current
    previousSessionUserIdRef.current = sessionUserId
    if (previousUserId && previousUserId !== sessionUserId) {
      projectSequenceRef.current += 1
      clearRemoteSource()
      void window.api?.hhcAssets?.clearContentLeases?.().catch(() => undefined)
      void stopProjection()
    }
  }, [clearRemoteSource, sessionUserId, stopProjection])

  useEffect(
    () => () => {
      projectSequenceRef.current += 1
      clearRemoteSource()
    },
    [clearRemoteSource]
  )

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
