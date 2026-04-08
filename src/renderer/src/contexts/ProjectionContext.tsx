import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

interface ProjectionContextValue {
  isProjectionOpen: boolean
  openProjection: () => Promise<void>
  closeProjection: () => Promise<void>
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

export function ProjectionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isProjectionOpen, setIsProjectionOpen] = useState(false)
  const adapterRef = useRef<ProjectionAdapter>(createProjectionAdapter())
  const projectionWindowRef = useRef<Window | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPolling = useCallback((): void => {
    if (pollTimerRef.current) return
    pollTimerRef.current = setInterval(() => {
      if (projectionWindowRef.current?.closed) {
        setIsProjectionOpen(false)
        projectionWindowRef.current = null
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
      }
    }, 1000)
  }, [])

  const stopPolling = useCallback((): void => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const currentAdapter = adapterRef.current

    if (isElectron()) {
      window.api.projection.check().then(({ exists }) => {
        setIsProjectionOpen(exists)
      })

      const unsubOpened = window.api.projection.onProjectionOpened(() => {
        setIsProjectionOpen(true)
      })
      const unsubClosed = window.api.projection.onProjectionClosed(() => {
        setIsProjectionOpen(false)
      })

      return () => {
        unsubOpened()
        unsubClosed()
        currentAdapter.dispose()
      }
    }

    const unsubPong = currentAdapter.on('__system:pong', () => {
      setIsProjectionOpen(true)
    })
    const unsubClosed = currentAdapter.on('__system:closed', () => {
      setIsProjectionOpen(false)
      projectionWindowRef.current = null
    })

    const win = window.open(getProjectionUrl(), 'hhc-projection')
    if (win) {
      projectionWindowRef.current = win
      startPolling()
    }

    const handleBeforeUnload = (): void => {
      currentAdapter.send('__system:close', null)
      projectionWindowRef.current?.close()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubPong()
      unsubClosed()
      stopPolling()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      projectionWindowRef.current?.close()
      currentAdapter.dispose()
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
      adapterRef.current.send('__system:close', null)
      projectionWindowRef.current = null
      setIsProjectionOpen(false)
      stopPolling()
    }
  }, [stopPolling])

  const send = useCallback(
    <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void => {
      adapterRef.current.send(channel, data)
    },
    []
  )

  const on = useCallback(
    <C extends ProjectionChannel>(
      channel: C,
      handler: (data: ProjectionPayload<C>) => void
    ): (() => void) => {
      return adapterRef.current.on(channel, handler)
    },
    []
  )

  return (
    <ProjectionContext.Provider
      value={{ isProjectionOpen, openProjection, closeProjection, send, on }}
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
