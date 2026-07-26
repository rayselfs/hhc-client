import { useEffect, useRef } from 'react'
import { usePresentationCloseDecision } from './PresentationCloseDecisionContext'
import { usePresentationSessionRegistry } from './PresentationSessionRegistryContext'
import { isElectron } from '@renderer/lib/env'

export default function PresentationElectronCloseBridge(): null {
  const registry = usePresentationSessionRegistry()
  const requestCloseDecision = usePresentationCloseDecision()
  const isClosingRef = useRef(false)

  useEffect(() => {
    if (!isElectron()) return
    return window.api.app.onCloseRequested(() => {
      if (isClosingRef.current) return
      isClosingRef.current = true
      void (async () => {
        try {
          await registry.flushAll()
        } catch {
          const decision = await requestCloseDecision(registry.getUnsafeItemIds())
          if (decision === 'keep-editing') return
          if (decision === 'retry') {
            await registry.flushAll()
          } else {
            await registry.discardAll()
          }
        }
        await window.api.app.confirmClose()
      })()
        .catch(() => undefined)
        .finally(() => {
          isClosingRef.current = false
        })
    })
  }, [registry, requestCloseDecision])

  return null
}
