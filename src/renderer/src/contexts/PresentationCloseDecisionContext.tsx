import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { CloseDecision } from './PresentationSessionRegistryContext'

export type { CloseDecision } from './PresentationSessionRegistryContext'

interface PendingCloseDecision {
  itemIds: string[]
  resolve: (decision: CloseDecision) => void
}

interface PresentationCloseDecisionContextValue {
  pending: PendingCloseDecision | null
  request: (itemIds: string[]) => Promise<CloseDecision>
}

const PresentationCloseDecisionContext =
  createContext<PresentationCloseDecisionContextValue | null>(null)

export function PresentationCloseDecisionProvider({
  children
}: {
  children: ReactNode
}): React.JSX.Element {
  const pendingPromiseRef = useRef<Promise<CloseDecision> | null>(null)
  const pendingResolveRef = useRef<((decision: CloseDecision) => void) | null>(null)
  const [pendingItemIds, setPendingItemIds] = useState<string[] | null>(null)

  const resolve = useCallback((decision: CloseDecision): void => {
    const pendingResolve = pendingResolveRef.current
    pendingPromiseRef.current = null
    pendingResolveRef.current = null
    setPendingItemIds(null)
    pendingResolve?.(decision)
  }, [])

  const request = useCallback((itemIds: string[]): Promise<CloseDecision> => {
    const pendingPromise = pendingPromiseRef.current
    if (pendingPromise) return pendingPromise

    let resolvePromise: (decision: CloseDecision) => void = () => undefined
    const promise = new Promise<CloseDecision>((resolveDecision) => {
      resolvePromise = resolveDecision
    })
    pendingPromiseRef.current = promise
    pendingResolveRef.current = resolvePromise
    setPendingItemIds([...itemIds])
    return promise
  }, [])

  useEffect(
    () => () => {
      pendingResolveRef.current?.('keep-editing')
      pendingPromiseRef.current = null
      pendingResolveRef.current = null
    },
    []
  )

  const value = useMemo<PresentationCloseDecisionContextValue>(
    () => ({
      pending: pendingItemIds ? { itemIds: pendingItemIds, resolve } : null,
      request
    }),
    [pendingItemIds, request, resolve]
  )

  return (
    <PresentationCloseDecisionContext.Provider value={value}>
      {children}
    </PresentationCloseDecisionContext.Provider>
  )
}

function usePresentationCloseDecisionContext(): PresentationCloseDecisionContextValue {
  const value = useContext(PresentationCloseDecisionContext)
  if (!value) {
    throw new Error(
      'Presentation close decisions must be used within PresentationCloseDecisionProvider'
    )
  }
  return value
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresentationCloseDecision(): (itemIds: string[]) => Promise<CloseDecision> {
  return usePresentationCloseDecisionContext().request
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePendingPresentationCloseDecision(): PendingCloseDecision | null {
  return usePresentationCloseDecisionContext().pending
}
