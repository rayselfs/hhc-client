import { useState, useEffect, useRef } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '../lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'

interface UseProjectionReturn {
  isProjectionOpen: boolean
  openProjection: () => Promise<void>
  closeProjection: () => Promise<void>
  send: (channel: string, data?: unknown) => void
  on: (channel: string, handler: (data: unknown) => void) => () => void
}

export function useProjection(): UseProjectionReturn {
  const [isProjectionOpen, setIsProjectionOpen] = useState(false)
  const adapterRef = useRef<ProjectionAdapter>(createProjectionAdapter())

  useEffect(() => {
    const currentAdapter = adapterRef.current

    // Initialize projection status and listeners (Electron only)
    if (isElectron()) {
      // Check current status
      window.api.projection.check().then(({ exists }) => {
        setIsProjectionOpen(exists)
      })

      // Listen for projection window lifecycle events
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

    return () => {
      currentAdapter.dispose()
    }
  }, [])

  const openProjection = async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.ensure()
    } else {
      window.open(location.origin + location.pathname + '#/projection', 'hhc-projection')
    }
  }

  const closeProjection = async (): Promise<void> => {
    if (isElectron()) {
      await window.api.projection.close()
    } else {
      adapterRef.current.send('__system:close', null)
    }
  }

  const send = (channel: string, data?: unknown): void => {
    adapterRef.current.send(channel, data)
  }

  const on = (channel: string, handler: (data: unknown) => void): (() => void) => {
    return adapterRef.current.on(channel, handler)
  }

  return { isProjectionOpen, openProjection, closeProjection, send, on }
}
