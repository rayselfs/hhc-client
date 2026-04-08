import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'

interface ProjectionContextValue {
  isProjectionOpen: boolean
  openProjection: () => Promise<void>
  closeProjection: () => Promise<void>
  send: (channel: string, data?: unknown) => void
  on: (channel: string, handler: (data: unknown) => void) => () => void
}

const ProjectionContext = createContext<ProjectionContextValue | null>(null)

export function ProjectionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isProjectionOpen, setIsProjectionOpen] = useState(false)
  const adapterRef = useRef<ProjectionAdapter>(createProjectionAdapter())
  const projectionWindowRef = useRef<Window | null>(null)

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

    const projectionUrl = location.origin + location.pathname + '#/projection'
    const win = window.open(projectionUrl, 'hhc-projection')
    projectionWindowRef.current = win

    const pollTimer = setInterval(() => {
      if (projectionWindowRef.current?.closed) {
        setIsProjectionOpen(false)
        projectionWindowRef.current = null
        clearInterval(pollTimer)
      }
    }, 1000)

    const handleBeforeUnload = (): void => {
      currentAdapter.send('__system:close', null)
      projectionWindowRef.current?.close()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubPong()
      unsubClosed()
      clearInterval(pollTimer)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      projectionWindowRef.current?.close()
      currentAdapter.dispose()
    }
  }, [])

  const openProjection = useCallback(async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.ensure()
    } else {
      const projectionUrl = location.origin + location.pathname + '#/projection'
      const win = window.open(projectionUrl, 'hhc-projection')
      projectionWindowRef.current = win
      setIsProjectionOpen(true)
    }
  }, [])

  const closeProjection = useCallback(async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.close()
    } else {
      adapterRef.current.send('__system:close', null)
      projectionWindowRef.current = null
      setIsProjectionOpen(false)
    }
  }, [])

  const send = useCallback((channel: string, data?: unknown): void => {
    adapterRef.current.send(channel, data)
  }, [])

  const on = useCallback((channel: string, handler: (data: unknown) => void): (() => void) => {
    return adapterRef.current.on(channel, handler)
  }, [])

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
