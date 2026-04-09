import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

/** Channels that carry displayable content (not system messages). */
type ContentChannel = Exclude<ProjectionChannel, `__system:${string}`>

interface ProjectOptions {
  /** When true, auto-reopen projection if it's closed. Default: false. */
  autoOpen?: boolean
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
  }, [stopPolling, setIsProjectionBlanked])

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
      })

      const unsubReady = adapter.on('__system:ready', () => {
        isReadyRef.current = true
        readyResolveRef.current?.()
        readyResolveRef.current = null
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
      projectionWindowRef.current = null
      stopPolling()
    })
    const unsubReady = adapter.on('__system:ready', () => {
      isReadyRef.current = true
      readyResolveRef.current?.()
      readyResolveRef.current = null
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
  }, [startPolling, stopPolling, setIsProjectionBlanked])

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
      stopPolling()
    }
  }, [stopPolling, setIsProjectionBlanked])

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
        if (options?.autoOpen && !isProjectionOpenRef.current) {
          openProjection().catch(() => undefined)
        }
        return
      }
      getAdapter(adapterRef).send(channel, data)
      if (isProjectionBlankedRef.current) {
        setIsProjectionBlanked(false)
        getAdapter(adapterRef).send('__system:blank', { showDefault: false })
      }
    },
    [setIsProjectionBlanked, openProjection]
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

  return (
    <ProjectionContext.Provider
      value={{
        isProjectionOpen,
        isProjectionBlanked,
        openProjection,
        closeProjection,
        blankProjection,
        project,
        send,
        on
      }}
    >
      {children}
    </ProjectionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjection(): ProjectionContextValue {
  const ctx = useContext(ProjectionContext)
  if (!ctx) {
    throw new Error('useProjection must be used within a ProjectionProvider')
  }
  return ctx
}
