import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { getBlobId } from '@renderer/lib/blob-identity'
import type { PresentationEditorSession } from '@renderer/lib/presentation-editor-session'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

export type CloseDecision = 'keep-editing' | 'retry' | 'discard'

export interface PresentationSessionRegistry {
  open(item: FileItemRecord): Promise<PresentationEditorSession>
  get(itemId: string): PresentationEditorSession | undefined
  activate(itemId: string): Promise<boolean>
  close(itemId: string, decision?: CloseDecision): Promise<boolean>
  flushAll(): Promise<void>
  discardAll(): Promise<void>
  hasUnsafeWork(): boolean
  getUnsafeItemIds(): string[]
  subscribe(listener: () => void): () => void
}

const PresentationSessionRegistryContext = createContext<PresentationSessionRegistry | null>(null)

function isSessionUnsafe(session: PresentationEditorSession): boolean {
  const snapshot = session.getSnapshot()
  return snapshot.draftKind !== null || snapshot.save.status !== 'saved'
}

export function PresentationSessionRegistryProvider({
  children
}: {
  children: ReactNode
}): React.JSX.Element {
  const sessionsRef = useRef(new Map<string, PresentationEditorSession>())
  const openingRef = useRef(new Map<string, Promise<PresentationEditorSession>>())
  const sessionUnsubscribersRef = useRef(new Map<string, () => void>())
  const listenersRef = useRef(new Set<() => void>())

  const registry = useMemo<PresentationSessionRegistry>(() => {
    const notify = (): void => {
      for (const listener of listenersRef.current) listener()
    }

    const publishSessionMetadata = (itemId: string, session: PresentationEditorSession): void => {
      const snapshot = session.getSnapshot()
      usePresentationWorkspaceStore.getState().updateEditorMetadata(itemId, {
        saveStatus: snapshot.save.status,
        mirrorWarnings: snapshot.save.mirrorWarnings,
        canUndo: snapshot.history.past.length > 0,
        canRedo: snapshot.history.future.length > 0
      })
    }

    const open = async (item: FileItemRecord): Promise<PresentationEditorSession> => {
      const existing = sessionsRef.current.get(item.id)
      if (existing) return existing
      const opening = openingRef.current.get(item.id)
      if (opening) return opening

      const promise = (async () => {
        const [
          { loadEditablePresentationSnapshot },
          { persistEditablePresentationRevision, refreshEditablePresentationThumbnail },
          { createPresentationEditorSession }
        ] = await Promise.all([
          import('@renderer/lib/editable-presentation'),
          import('@renderer/lib/editable-presentation-persistence'),
          import('@renderer/lib/presentation-editor-session')
        ])
        const { document, revision } = await loadEditablePresentationSnapshot(item)
        const session = createPresentationEditorSession({
          initialDocument: document,
          initialRevision: revision,
          persist: (request) =>
            persistEditablePresentationRevision({
              ...request,
              itemId: item.id,
              sourceBlobId: getBlobId(item)
            }),
          refreshThumbnail: refreshEditablePresentationThumbnail
        })
        sessionsRef.current.set(item.id, session)
        publishSessionMetadata(item.id, session)
        sessionUnsubscribersRef.current.set(
          item.id,
          session.subscribe(() => {
            publishSessionMetadata(item.id, session)
            notify()
          })
        )
        notify()
        return session
      })()
      openingRef.current.set(item.id, promise)
      try {
        return await promise
      } finally {
        openingRef.current.delete(item.id)
      }
    }

    const getUnsafeItemIds = (): string[] =>
      [...sessionsRef.current.entries()]
        .filter(([, session]) => isSessionUnsafe(session))
        .map(([itemId]) => itemId)

    return {
      open,
      get: (itemId) => sessionsRef.current.get(itemId),
      activate: async (itemId) => {
        const workspace = usePresentationWorkspaceStore.getState()
        const previousItemId = workspace.activeItemId
        if (previousItemId === itemId) return true
        const previousSession = previousItemId ? sessionsRef.current.get(previousItemId) : undefined
        if (previousSession) {
          try {
            await previousSession.flush()
          } catch {
            return false
          }
        }
        usePresentationWorkspaceStore.getState().setActiveDocument(itemId)
        return true
      },
      close: async (itemId, decision) => {
        if (decision === 'keep-editing') return false
        const session = sessionsRef.current.get(itemId)
        if (session) {
          if (decision === 'discard') {
            await session.discard()
          } else {
            try {
              await session.flush()
            } catch {
              return false
            }
          }
          sessionUnsubscribersRef.current.get(itemId)?.()
          sessionUnsubscribersRef.current.delete(itemId)
          session.dispose()
          sessionsRef.current.delete(itemId)
        }
        usePresentationWorkspaceStore.getState().closeDocument(itemId)
        notify()
        return true
      },
      flushAll: async () => {
        const unsafeSessions = [...sessionsRef.current.values()].filter(isSessionUnsafe)
        await Promise.all(unsafeSessions.map((session) => session.flush()))
      },
      discardAll: async () => {
        const unsafeSessions = [...sessionsRef.current.values()].filter(isSessionUnsafe)
        await Promise.all(unsafeSessions.map((session) => session.discard()))
      },
      hasUnsafeWork: () => getUnsafeItemIds().length > 0,
      getUnsafeItemIds,
      subscribe: (listener) => {
        listenersRef.current.add(listener)
        return () => listenersRef.current.delete(listener)
      }
    }
  }, [])

  useEffect(
    () => () => {
      for (const unsubscribe of sessionUnsubscribersRef.current.values()) unsubscribe()
      for (const session of sessionsRef.current.values()) session.dispose()
      sessionUnsubscribersRef.current.clear()
      sessionsRef.current.clear()
      openingRef.current.clear()
      listenersRef.current.clear()
    },
    []
  )

  return (
    <PresentationSessionRegistryContext.Provider value={registry}>
      {children}
    </PresentationSessionRegistryContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresentationSessionRegistry(): PresentationSessionRegistry {
  const registry = useContext(PresentationSessionRegistryContext)
  if (!registry) {
    throw new Error(
      'usePresentationSessionRegistry must be used within PresentationSessionRegistryProvider'
    )
  }
  return registry
}
