import { useState, useEffect } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '../lib/projection-adapter'
import { isElectron } from '../../../shared/env'

export function useProjection() {
  const [isProjectionOpen, setIsProjectionOpen] = useState(false)
  const [adapter, setAdapter] = useState<ProjectionAdapter | null>(null)

  useEffect(() => {
    const newAdapter = createProjectionAdapter()
    setAdapter(newAdapter)

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
        newAdapter.dispose()
      }
    }

    return () => {
      newAdapter.dispose()
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
      adapter?.send('__system:close', null)
    }
  }

  const send = (channel: string, data?: unknown): void => {
    adapter?.send(channel, data)
  }

  const on = (channel: string, handler: (data: unknown) => void): (() => void) => {
    if (!adapter) return () => {}
    return adapter.on(channel, handler)
  }

  return { isProjectionOpen, openProjection, closeProjection, send, on }
}
