import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import {
  createProjectionSessionCoordinator,
  type ProjectionRecoveryState,
  type ProjectionSessionCoordinator,
  type ReplayableProjectionChannel
} from '@renderer/lib/projection-session-coordinator'
import { useSettingsStore } from '@renderer/stores/settings'
import type { ProjectionVlcFailure } from '@shared/ipc-channels'
import type {
  ProjectionChannel,
  ProjectionContentChannel,
  ProjectionContentMessageTuple,
  ProjectionFailure,
  ProjectionOperationResult,
  ProjectionOwner,
  ProjectionPayload,
  ProjectionSessionSnapshot
} from '@shared/projection-messages'

export type {
  ProjectionContentMessageTuple as ContentMessageTuple,
  ProjectionOwner
} from '@shared/projection-messages'

interface ProjectOptions {
  autoOpen?: boolean
  bringToFront?: boolean
}

export interface StartProjectionOptions {
  bringToFront?: boolean
}

export interface ProjectionSessionSummary {
  owner: ProjectionOwner | null
  status: 'closed' | 'opening' | 'connected' | 'projecting' | 'failed'
  label: string | null
  isBlackout: boolean
  failure: ProjectionFailure | null
}

interface ProjectionContextValue {
  isProjectionOpen: boolean
  projectionReadyCount: number
  activeOwner: ProjectionOwner
  recovery: ProjectionRecoveryState
  vlcFailure: ProjectionVlcFailure | null
  sessionSummary: ProjectionSessionSummary
  claimProjection: (owner: ProjectionOwner, options?: { unblank?: boolean }) => void
  startProjection: (
    owner: ProjectionOwner,
    payloads?: ProjectionContentMessageTuple[],
    options?: StartProjectionOptions
  ) => Promise<ProjectionOperationResult>
  stopProjection: () => Promise<void>
  retryProjection: () => Promise<ProjectionOperationResult>
  bringProjectionToFront: () => Promise<void>
  closeProjection: () => Promise<void>
  blackoutProjection: (enabled: boolean) => Promise<void>
  getProjectionSnapshot: () => ProjectionSessionSnapshot | null
  project: <C extends ProjectionContentChannel>(
    channel: C,
    data: ProjectionPayload<C>,
    options?: ProjectOptions
  ) => Promise<void>
  send: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) => void
  on: <C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ) => () => void
}

const CLOSED_RECOVERY_STATE: ProjectionRecoveryState = {
  status: 'closed',
  generation: 0,
  failure: null
}

const ProjectionContext = createContext<ProjectionContextValue | null>(null)

function getProjectionUrl(generation: number, sessionId: string): string {
  const query = new URLSearchParams({ generation: String(generation), session: sessionId })
  return `${location.origin}${location.pathname}#/projection?${query}`
}

function getAdapter(
  ref: React.RefObject<ProjectionAdapter | null>,
  browserSessionId: string
): ProjectionAdapter {
  if (!ref.current) ref.current = createProjectionAdapter('main', browserSessionId)
  return ref.current
}

export function ProjectionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isProjectionOpen, setIsProjectionOpen] = useState(false)
  const [projectionReadyCount, setProjectionReadyCount] = useState(0)
  const [activeOwner, setActiveOwner] = useState<ProjectionOwner>('timer')
  const [recovery, setRecovery] = useState<ProjectionRecoveryState>(CLOSED_RECOVERY_STATE)
  const [vlcFailure, setVlcFailure] = useState<ProjectionVlcFailure | null>(null)
  const [projectionSnapshot, setProjectionSnapshot] = useState<ProjectionSessionSnapshot | null>(
    null
  )
  const projectionDisplayId = useSettingsStore((state) => state.projectionDisplayId)
  const [browserSessionId] = useState(() => crypto.randomUUID())
  const adapterRef = useRef<ProjectionAdapter | null>(null)
  const coordinatorRef = useRef<ProjectionSessionCoordinator | null>(null)
  const projectionWindowRef = useRef<Window | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const browserGenerationRef = useRef(0)
  const isProjectionOpenRef = useRef(false)

  const updateOpen = useCallback((open: boolean): void => {
    isProjectionOpenRef.current = open
    setIsProjectionOpen(open)
  }, [])

  const getCoordinator = useCallback((): ProjectionSessionCoordinator => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = createProjectionSessionCoordinator((channel, data) => {
        getAdapter(adapterRef, browserSessionId).send(channel, data)
      })
    }
    return coordinatorRef.current
  }, [browserSessionId])

  const stopPolling = useCallback((): void => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
  }, [])

  const endBrowserSession = useCallback((): void => {
    getCoordinator().endSession()
    getAdapter(adapterRef, browserSessionId).setGeneration(0)
    projectionWindowRef.current = null
    updateOpen(false)
    stopPolling()
  }, [browserSessionId, getCoordinator, stopPolling, updateOpen])

  const startPolling = useCallback((): void => {
    if (pollTimerRef.current) return
    pollTimerRef.current = setInterval(() => {
      if (projectionWindowRef.current?.closed) endBrowserSession()
    }, 1000)
  }, [endBrowserSession])

  useEffect(() => {
    const adapter = getAdapter(adapterRef, browserSessionId)
    const coordinator = getCoordinator()
    const syncCoordinatorState = (): void => {
      const next = coordinator.getRecoveryState()
      setRecovery({
        ...next,
        failure: next.failure ? { ...next.failure } : null
      })
      setProjectionSnapshot(coordinator.getSnapshot())
    }
    const unsubscribeCoordinator = coordinator.subscribe(syncCoordinatorState)
    const unsubscribeReady = adapter.on('__system:ready', (data) => {
      if (
        !isElectron() &&
        coordinator.getRecoveryState().status === 'ready' &&
        coordinator.getRecoveryState().generation === data.generation
      ) {
        coordinator.beginGeneration({
          generation: data.generation,
          status: 'opening',
          reason: 'reload'
        })
      }
      coordinator.ready(data.generation)
      setProjectionReadyCount((count) => count + 1)
    })
    const unsubscribePlayback = adapter.on('file:playback-state', (data) => {
      coordinator.recordPlayback(adapter.getGeneration(), data)
    })

    if (isElectron()) {
      let active = true
      void window.api.projection.check().then((state) => {
        if (!active) return
        updateOpen(state.exists)
        if (state.lifecycle.generation > 0) {
          adapter.setGeneration(state.lifecycle.generation)
          coordinator.beginGeneration(state.lifecycle)
        }
      })
      const unsubscribeLifecycle = window.api.projection.onProjectionLifecycle((event) => {
        if (event.generation > 0) adapter.setGeneration(event.generation)
        coordinator.beginGeneration(event)
        const open =
          event.status === 'opening' || event.status === 'ready' || event.status === 'recovering'
        updateOpen(open)
        if (event.status === 'closed') {
          coordinator.endSession()
          adapter.setGeneration(0)
        }
      })
      const unsubscribeVlcFailure = window.api.projectionVlc.onFailure(setVlcFailure)
      const unsubscribeVlcStarted = window.api.projectionVlc.onStarted((generation, itemId) => {
        setVlcFailure((failure) =>
          generation === coordinator.getRecoveryState().generation &&
          failure &&
          (!failure.itemId || failure.itemId === itemId)
            ? null
            : failure
        )
      })

      return () => {
        active = false
        unsubscribeLifecycle()
        unsubscribeVlcFailure()
        unsubscribeVlcStarted()
        unsubscribeReady()
        unsubscribePlayback()
        unsubscribeCoordinator()
        coordinator.dispose()
        coordinatorRef.current = null
        adapter.dispose()
        adapterRef.current = null
      }
    }

    const unsubscribePong = adapter.on('__system:pong', () => updateOpen(true))
    const unsubscribeClosed = adapter.on('__system:closed', endBrowserSession)
    const handleBeforeUnload = (): void => {
      adapter.send('__system:close', null)
      projectionWindowRef.current?.close()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubscribePong()
      unsubscribeClosed()
      unsubscribeReady()
      unsubscribePlayback()
      unsubscribeCoordinator()
      stopPolling()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      projectionWindowRef.current?.close()
      coordinator.dispose()
      coordinatorRef.current = null
      adapter.dispose()
      adapterRef.current = null
    }
  }, [browserSessionId, endBrowserSession, getCoordinator, stopPolling, updateOpen])

  const bringProjectionToFront = useCallback(async (): Promise<void> => {
    if (!isElectron()) return
    await window.api.projection.bringToFront().catch((error) => {
      console.warn('[Projection] Bring to front failed:', error)
    })
  }, [])

  const openBrowserProjection = useCallback(async (): Promise<ProjectionOperationResult> => {
    const coordinator = getCoordinator()
    const adapter = getAdapter(adapterRef, browserSessionId)
    if (projectionWindowRef.current && !projectionWindowRef.current.closed) {
      const generation = adapter.getGeneration()
      return coordinator.waitForReady(generation)
    }

    browserGenerationRef.current += 1
    const generation = browserGenerationRef.current
    adapter.setGeneration(generation)
    coordinator.beginGeneration({ generation, status: 'opening', reason: 'created' })
    const win = window.open(
      getProjectionUrl(generation, browserSessionId),
      `hhc-projection-${browserSessionId}`,
      `popup,width=${screen.availWidth},height=${screen.availHeight},left=0,top=0`
    )
    if (!win) {
      coordinator.fail(generation, 'popup-blocked')
      return { ok: false, generation, reason: 'popup-blocked' }
    }
    projectionWindowRef.current = win
    updateOpen(true)
    startPolling()
    return coordinator.waitForReady(generation)
  }, [browserSessionId, getCoordinator, startPolling, updateOpen])

  const openElectronProjection = useCallback(async (): Promise<ProjectionOperationResult> => {
    const coordinator = getCoordinator()
    const adapter = getAdapter(adapterRef, browserSessionId)
    const state = coordinator.getRecoveryState()
    if (state.status === 'ready') return { ok: true, generation: state.generation }

    const result =
      state.status === 'failed'
        ? await window.api.projection.retry()
        : await window.api.projection.ensure(projectionDisplayId)
    const generation = result.generation
    if (generation <= 0) {
      coordinator.fail(state.generation, 'ready-timeout')
      return { ok: false, generation: state.generation, reason: 'ready-timeout' }
    }
    adapter.setGeneration(generation)
    coordinator.beginGeneration({ generation, status: 'opening', reason: 'created' })
    updateOpen(true)
    return coordinator.waitForReady(generation)
  }, [browserSessionId, getCoordinator, projectionDisplayId, updateOpen])

  const openProjection = useCallback(async (): Promise<ProjectionOperationResult> => {
    return isElectron() ? openElectronProjection() : openBrowserProjection()
  }, [openBrowserProjection, openElectronProjection])

  const retryProjection = useCallback(async (): Promise<ProjectionOperationResult> => {
    if (!isElectron()) {
      projectionWindowRef.current = null
      return openBrowserProjection()
    }
    const coordinator = getCoordinator()
    const state = coordinator.getRecoveryState()
    const snapshot = coordinator.getSnapshot()
    if (
      vlcFailure &&
      state.status === 'ready' &&
      snapshot?.owner === 'media' &&
      !snapshot.showDefault &&
      !snapshot.isBlackout &&
      snapshot.media.show &&
      (!vlcFailure.itemId || snapshot.media.show.itemId === vlcFailure.itemId)
    ) {
      getAdapter(adapterRef, browserSessionId).send('__system:replay', {
        generation: state.generation,
        snapshot: structuredClone(snapshot)
      })
      return { ok: true, generation: state.generation }
    }
    const result = await window.api.projection.retry()
    if (!result.retried || result.generation <= 0) {
      return {
        ok: false,
        generation: state.generation,
        reason: state.failure?.reason ?? 'ready-timeout'
      }
    }
    getAdapter(adapterRef, browserSessionId).setGeneration(result.generation)
    coordinator.beginGeneration({
      generation: result.generation,
      status: 'opening',
      reason: 'created'
    })
    updateOpen(true)
    return coordinator.waitForReady(result.generation)
  }, [browserSessionId, getCoordinator, openBrowserProjection, updateOpen, vlcFailure])

  const closeProjection = useCallback(async (): Promise<void> => {
    const coordinator = getCoordinator()
    const adapter = getAdapter(adapterRef, browserSessionId)
    coordinator.endSession()
    if (isElectron()) {
      await window.api.projection.close()
    } else {
      adapter.send('__system:close', null)
      projectionWindowRef.current?.close()
      projectionWindowRef.current = null
      stopPolling()
    }
    adapter.setGeneration(0)
    updateOpen(false)
  }, [browserSessionId, getCoordinator, stopPolling, updateOpen])

  const claimProjection = useCallback(
    (owner: ProjectionOwner, options?: { unblank?: boolean }): void => {
      setActiveOwner(owner)
      getCoordinator().claim(owner, options?.unblank)
    },
    [getCoordinator]
  )

  const blackoutProjection = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (enabled) await window.api?.projectionVlc?.stop?.().catch(() => {})
      getCoordinator().blackout(enabled)
    },
    [getCoordinator]
  )

  const getProjectionSnapshot = useCallback(
    (): ProjectionSessionSnapshot | null => getCoordinator().getSnapshot(),
    [getCoordinator]
  )

  const startProjection = useCallback(
    async (
      owner: ProjectionOwner,
      payloads: ProjectionContentMessageTuple[] = [],
      options?: StartProjectionOptions
    ): Promise<ProjectionOperationResult> => {
      const coordinator = getCoordinator()
      coordinator.startSession(owner, payloads)
      setActiveOwner(owner)

      let result: ProjectionOperationResult
      if (coordinator.getRecoveryState().status === 'ready') {
        result = {
          ok: true,
          generation: coordinator.getRecoveryState().generation
        }
      } else {
        result = await openProjection()
      }
      if (result.ok && options?.bringToFront !== false) await bringProjectionToFront()
      return result
    },
    [bringProjectionToFront, getCoordinator, openProjection]
  )

  const stopProjection = useCallback(async (): Promise<void> => {
    await window.api?.projectionVlc?.stop?.().catch(() => {})
    await closeProjection()
  }, [closeProjection])

  const send = useCallback(
    <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void => {
      const coordinator = getCoordinator()
      if (channel === 'file:playback-state') {
        coordinator.recordPlayback(
          getAdapter(adapterRef, browserSessionId).getGeneration(),
          data as ProjectionPayload<'file:playback-state'>
        )
      } else if (channel === 'file:end') {
        coordinator.sendOneShot('file:end', null)
      } else if (!channel.startsWith('__system:')) {
        coordinator.project(
          channel as ReplayableProjectionChannel,
          data as ProjectionPayload<ReplayableProjectionChannel>
        )
      } else {
        getAdapter(adapterRef, browserSessionId).send(channel, data)
      }
    },
    [browserSessionId, getCoordinator]
  )

  const project = useCallback(
    async <C extends ProjectionContentChannel>(
      channel: C,
      data: ProjectionPayload<C>,
      options?: ProjectOptions
    ): Promise<void> => {
      const coordinator = getCoordinator()
      if (channel === 'file:end') {
        coordinator.sendOneShot('file:end', null)
      } else {
        coordinator.project(
          channel as ReplayableProjectionChannel,
          data as ProjectionPayload<ReplayableProjectionChannel>
        )
      }
      if (options?.autoOpen && !isProjectionOpenRef.current) await openProjection()
      if (options?.bringToFront && isProjectionOpenRef.current) {
        await bringProjectionToFront()
      }
    },
    [bringProjectionToFront, getCoordinator, openProjection]
  )

  const on = useCallback(
    <C extends ProjectionChannel>(
      channel: C,
      handler: (data: ProjectionPayload<C>) => void
    ): (() => void) => getAdapter(adapterRef, browserSessionId).on(channel, handler),
    [browserSessionId]
  )

  const sessionSummary = useMemo<ProjectionSessionSummary>(() => {
    const status: ProjectionSessionSummary['status'] =
      recovery.status === 'failed'
        ? 'failed'
        : recovery.status === 'opening' || recovery.status === 'recovering'
          ? 'opening'
          : recovery.status === 'ready' && isProjectionOpen
            ? projectionSnapshot && !projectionSnapshot.isBlackout
              ? 'projecting'
              : 'connected'
            : 'closed'

    return {
      owner: projectionSnapshot?.owner ?? null,
      status,
      label: projectionSnapshot?.media.show?.fileName ?? null,
      isBlackout: projectionSnapshot?.isBlackout ?? false,
      failure: recovery.failure
    }
  }, [isProjectionOpen, projectionSnapshot, recovery])

  const contextValue = useMemo(
    () => ({
      isProjectionOpen,
      projectionReadyCount,
      activeOwner,
      recovery,
      vlcFailure,
      sessionSummary,
      claimProjection,
      startProjection,
      stopProjection,
      retryProjection,
      bringProjectionToFront,
      closeProjection,
      blackoutProjection,
      getProjectionSnapshot,
      project,
      send,
      on
    }),
    [
      isProjectionOpen,
      projectionReadyCount,
      activeOwner,
      recovery,
      vlcFailure,
      sessionSummary,
      claimProjection,
      startProjection,
      stopProjection,
      retryProjection,
      bringProjectionToFront,
      closeProjection,
      blackoutProjection,
      getProjectionSnapshot,
      project,
      send,
      on
    ]
  )

  return <ProjectionContext.Provider value={contextValue}>{children}</ProjectionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjection(): ProjectionContextValue {
  const context = useContext(ProjectionContext)
  if (!context) throw new Error('useProjection must be used within a ProjectionProvider')
  return context
}
