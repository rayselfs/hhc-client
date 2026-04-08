import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

interface ProjectionContextValue {
  isProjectionOpen: boolean
  isProjectionBlanked: boolean
  openProjection: () => Promise<void>
  closeProjection: () => Promise<void>
  blankProjection: (blank: boolean) => void
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
  const [isProjectionOpen, setIsProjectionOpen] = useState(false)
  const [isProjectionBlanked, setIsProjectionBlanked] = useState(true)
  const adapterRef = useRef<ProjectionAdapter | null>(null)
  const projectionWindowRef = useRef<Window | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
        projectionWindowRef.current = null
        stopPolling()
      }
    }, 1000)
  }, [stopPolling])

  useEffect(() => {
    const adapter = getAdapter(adapterRef)

    if (isElectron()) {
      window.api.projection.check().then(({ exists }) => {
        setIsProjectionOpen(exists)
      })

      const unsubOpened = window.api.projection.onProjectionOpened(() => {
        setIsProjectionOpen(true)
      })
      const unsubClosed = window.api.projection.onProjectionClosed(() => {
        setIsProjectionOpen(false)
        setIsProjectionBlanked(true)
      })

      return () => {
        unsubOpened()
        unsubClosed()
        adapter.dispose()
      }
    }

    const unsubPong = adapter.on('__system:pong', () => {
      setIsProjectionOpen(true)
    })
    const unsubClosed = adapter.on('__system:closed', () => {
      setIsProjectionOpen(false)
      setIsProjectionBlanked(true)
      projectionWindowRef.current = null
      stopPolling()
    })

    const handleBeforeUnload = (): void => {
      adapter.send('__system:close', null)
      projectionWindowRef.current?.close()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubPong()
      unsubClosed()
      stopPolling()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      projectionWindowRef.current?.close()
      adapter.dispose()
    }
  }, [startPolling, stopPolling])

  const openProjection = useCallback(async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.ensure()
      return
    }

    const win = window.open(getProjectionUrl(), 'hhc-projection')
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
      stopPolling()
    }
  }, [stopPolling])

  const blankProjection = useCallback((blank: boolean): void => {
    setIsProjectionBlanked(blank)
    getAdapter(adapterRef).send('__system:blank', { showDefault: blank })
  }, [])

  const send = useCallback(
    <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void => {
      getAdapter(adapterRef).send(channel, data)
    },
    []
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
