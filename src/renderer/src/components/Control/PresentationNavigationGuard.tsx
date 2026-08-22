import { useCallback, useEffect, useRef } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { usePresentationCloseDecision } from '@renderer/contexts/PresentationCloseDecisionContext'
import {
  usePresentationSessionRegistry,
  type PresentationSessionRegistry
} from '@renderer/contexts/PresentationSessionRegistryContext'

type RequestCloseDecision = ReturnType<typeof usePresentationCloseDecision>

async function resolveUnsafePresentationWork(
  registry: PresentationSessionRegistry,
  requestCloseDecision: RequestCloseDecision
): Promise<boolean> {
  try {
    await registry.flushAll()
    return true
  } catch {
    const decision = await requestCloseDecision(registry.getUnsafeItemIds())
    if (decision === 'keep-editing') return false
    try {
      if (decision === 'retry') {
        await registry.flushAll()
      } else {
        await registry.discardAll()
      }
      return true
    } catch {
      return false
    }
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresentationSafeAction(): (
  action: () => void | Promise<void>
) => Promise<boolean> {
  const registry = usePresentationSessionRegistry()
  const requestCloseDecision = usePresentationCloseDecision()

  return useCallback(
    async (action) => {
      if (!(await resolveUnsafePresentationWork(registry, requestCloseDecision))) return false
      await action()
      return true
    },
    [registry, requestCloseDecision]
  )
}

export default function PresentationNavigationGuard(): null {
  const registry = usePresentationSessionRegistry()
  const requestCloseDecision = usePresentationCloseDecision()
  const isProcessingRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      registry.hasUnsafeWork() && currentLocation.pathname !== nextLocation.pathname
  )

  useBeforeUnload((event) => {
    if (!registry.hasUnsafeWork()) return
    event.preventDefault()
    event.returnValue = ''
  })

  useEffect(() => {
    if (blocker.state !== 'blocked' || isProcessingRef.current) return
    isProcessingRef.current = true
    void resolveUnsafePresentationWork(registry, requestCloseDecision)
      .then((canLeave) => {
        if (canLeave) {
          blocker.proceed()
        } else {
          blocker.reset()
        }
      })
      .catch(() => blocker.reset())
      .finally(() => {
        isProcessingRef.current = false
      })
  }, [blocker, registry, requestCloseDecision])

  return null
}
