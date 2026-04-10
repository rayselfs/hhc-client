import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

/** Channels that carry displayable content (not system messages). */
type ContentChannel = Exclude<ProjectionChannel, `__system:${string}`>

interface ProjectOptions {
  /** When true, auto-reopen projection if it's closed. Default: false. */
  autoOpen?: boolean
  /** When true, auto-unblank projection to show content. Default: false. */
  autoShow?: boolean
}

interface ProjectionContextValue {
  isProjectionOpen: boolean
  isProjectionBlanked: boolean
  openProjection: () => Promise<void>
  closeProjection: () => Promise<void>
  blankProjection: (blank: boolean) => void
  /** High-level: send content to projection and unblank. Pass autoOpen to reopen if closed. */
  project: <C extends ContentChannel>(
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

const ProjectionContext = createContext<ProjectionContextValue | null>(null)

function getProjectionUrl(): string {
  return location.origin + location.pathname + '#/projection'
}

function getAdapter(ref: React.RefObject<ProjectionAdapter | null>): ProjectionAdapter {
  if (!ref.current) {
    ref.current = createProjectionAdapter()
  }
  return ref.current
}

export function ProjectionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isProjectionOpen, _setIsProjectionOpen] = useState(false)
  const [isProjectionBlanked, _setIsProjectionBlanked] = useState(true)
  const adapterRef = useRef<ProjectionAdapter | null>(null)
  const projectionWindowRef = useRef<Window | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const readyResolveRef = useRef<(() => void) | null>(null)
  const isReadyRef = useRef(false)
  const isProjectionBlankedRef = useRef(true)
  const isProjectionOpenRef = useRef(false)
  const pendingPayloadsRef = useRef(new Map<string, { channel: string; data: unknown }>())
  const pendingAutoShowRef = useRef(false)
  const autoOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setIsProjectionBlanked = useCallback((blanked: boolean): void => {
    isProjectionBlankedRef.current = blanked
    _setIsProjectionBlanked(blanked)
  }, [])

  const setIsProjectionOpen = useCallback((open: boolean): void => {
    isProjectionOpenRef.current = open
    _setIsProjectionOpen(open)
  }, [])

  const stopPolling = useCallback((): void => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const clearPending = useCallback((): void => {
    pendingPayloadsRef.current.clear()
    pendingAutoShowRef.current = false
    if (autoOpenTimeoutRef.current) {
      clearTimeout(autoOpenTimeoutRef.current)
      autoOpenTimeoutRef.current = null
    }
  }, [])

  const flushPendingPayloads = useCallback((): void => {
    const adapter = getAdapter(adapterRef)
    pendingPayloadsRef.current.forEach(({ channel, data }) => {
      adapter.send(channel as ContentChannel, data as ProjectionPayload<ContentChannel>)
    })
    if (pendingAutoShowRef.current && isProjectionBlankedRef.current) {
      setIsProjectionBlanked(false)
      adapter.send('__system:blank', { showDefault: false })
    }
    clearPending()
  }, [setIsProjectionBlanked, clearPending])

  const startPolling = useCallback((): void => {
    if (pollTimerRef.current) return
    pollTimerRef.current = setInterval(() => {
      if (projectionWindowRef.current?.closed) {
        setIsProjectionOpen(false)
        setIsProjectionBlanked(true)
        isReadyRef.current = false
        projectionWindowRef.current = null
        stopPolling()
      }
    }, 1000)
  }, [stopPolling, setIsProjectionOpen, setIsProjectionBlanked])

  useEffect(() => {
    const adapter = getAdapter(adapterRef)

    if (isElectron()) {
      window.api.projection.check().then(({ exists }) => {
        setIsProjectionOpen(exists)
        if (exists) isReadyRef.current = true
      })

      const unsubOpened = window.api.projection.onProjectionOpened(() => {
        setIsProjectionOpen(true)
      })
      const unsubClosed = window.api.projection.onProjectionClosed(() => {
        setIsProjectionOpen(false)
        setIsProjectionBlanked(true)
        isReadyRef.current = false
        readyResolveRef.current = null
        clearPending()
      })

      const unsubReady = adapter.on('__system:ready', () => {
        isReadyRef.current = true
        readyResolveRef.current?.()
        readyResolveRef.current = null
        flushPendingPayloads()
      })

      return () => {
        unsubOpened()
        unsubClosed()
        unsubReady()
        adapter.dispose()
        adapterRef.current = null
      }
    }

    const unsubPong = adapter.on('__system:pong', () => {
      setIsProjectionOpen(true)
    })
    const unsubClosed = adapter.on('__system:closed', () => {
      setIsProjectionOpen(false)
      setIsProjectionBlanked(true)
      isReadyRef.current = false
      readyResolveRef.current = null
      clearPending()
      projectionWindowRef.current = null
      stopPolling()
    })
    const unsubReady = adapter.on('__system:ready', () => {
      isReadyRef.current = true
      readyResolveRef.current?.()
      readyResolveRef.current = null
      flushPendingPayloads()
    })

    const handleBeforeUnload = (): void => {
      adapter.send('__system:close', null)
      projectionWindowRef.current?.close()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubPong()
      unsubClosed()
      unsubReady()
      stopPolling()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      projectionWindowRef.current?.close()
      adapter.dispose()
      adapterRef.current = null
    }
  }, [
    startPolling,
    stopPolling,
    setIsProjectionOpen,
    setIsProjectionBlanked,
    clearPending,
    flushPendingPayloads
  ])

  const openProjection = useCallback(async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.ensure()
      return
    }

    const width = screen.availWidth
    const height = screen.availHeight
    const win = window.open(
      getProjectionUrl(),
      'hhc-projection',
      `popup,width=${width},height=${height},left=0,top=0`
    )
    if (!win) return
    projectionWindowRef.current = win
    startPolling()
  }, [startPolling])

  const closeProjection = useCallback(async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.close()
    } else {
      getAdapter(adapterRef).send('__system:close', null)
      projectionWindowRef.current = null
      setIsProjectionOpen(false)
      setIsProjectionBlanked(true)
      isReadyRef.current = false
      readyResolveRef.current = null
      clearPending()
      stopPolling()
    }
  }, [stopPolling, setIsProjectionOpen, setIsProjectionBlanked, clearPending])

  const blankProjection = useCallback(
    (blank: boolean): void => {
      setIsProjectionBlanked(blank)
      getAdapter(adapterRef).send('__system:blank', { showDefault: blank })
    },
    [setIsProjectionBlanked]
  )

  const send = useCallback(
    <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void => {
      getAdapter(adapterRef).send(channel, data)
    },
    []
  )

  const project = useCallback(
    async <C extends ContentChannel>(
      channel: C,
      data: ProjectionPayload<C>,
      options?: ProjectOptions
    ): Promise<void> => {
      if (!isReadyRef.current) {
        pendingPayloadsRef.current.set(channel, { channel, data })
        if (options?.autoShow) pendingAutoShowRef.current = true

        if (options?.autoOpen && !isProjectionOpenRef.current) {
          openProjection().catch(() => {
            console.warn('[Projection] Auto-reopen failed')
            pendingPayloadsRef.current.delete(channel)
          })
          if (!autoOpenTimeoutRef.current) {
            autoOpenTimeoutRef.current = setTimeout(() => {
              if (!isReadyRef.current) {
                console.warn('[Projection] Ready timeout — discarding pending payloads')
                clearPending()
              }
            }, 5000)
          }
        }
        return
      }

      getAdapter(adapterRef).send(channel, data)
      if (options?.autoShow && isProjectionBlankedRef.current) {
        setIsProjectionBlanked(false)
        getAdapter(adapterRef).send('__system:blank', { showDefault: false })
      }
    },
    [setIsProjectionBlanked, openProjection, clearPending]
  )

  const on = useCallback(
    <C extends ProjectionChannel>(
      channel: C,
      handler: (data: ProjectionPayload<C>) => void
    ): (() => void) => {
      return getAdapter(adapterRef).on(channel, handler)
    },
    []
  )

  const contextValue = useMemo(
    () => ({
      isProjectionOpen,
      isProjectionBlanked,
      openProjection,
      closeProjection,
      blankProjection,
      project,
      send,
      on
    }),
    [
      isProjectionOpen,
      isProjectionBlanked,
      openProjection,
      closeProjection,
      blankProjection,
      project,
      send,
      on
    ]
  )

  return <ProjectionContext.Provider value={contextValue}>{children}</ProjectionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjection(): ProjectionContextValue {
  const ctx = useContext(ProjectionContext)
  if (!ctx) {
    throw new Error('useProjection must be used within a ProjectionProvider')
  }
  return ctx
}
