import type { EditablePresentationDocument } from './editable-presentation'

export type PresentationSaveStatus = 'dirty' | 'saving' | 'saved' | 'error'
export type PresentationMirrorWarning = 'derived-document' | 'thumbnail'

export interface PresentationSaveState {
  status: PresentationSaveStatus
  scheduledRevision: number
  persistedRevision: number
  error: string | null
  mirrorWarnings: PresentationMirrorWarning[]
}

export interface PresentationSaveRequest {
  revision: number
  document: EditablePresentationDocument
  catalogName?: string
}

export interface PersistPresentationRevisionResult {
  revision: number
  mirrorWarnings: PresentationMirrorWarning[]
}

export type PersistPresentationRevision = (
  request: PresentationSaveRequest
) => Promise<PersistPresentationRevisionResult>

export interface PresentationSaveCoordinator {
  schedule(document: EditablePresentationDocument, catalogName?: string): number
  retry(): void
  flush(): Promise<void>
  discard(): Promise<void>
  subscribe(listener: (state: PresentationSaveState) => void): () => void
  getState(): PresentationSaveState
  getLastPersistedDocument(): EditablePresentationDocument
  dispose(): void
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function createPresentationSaveCoordinator(
  initialDocument: EditablePresentationDocument,
  persist: PersistPresentationRevision,
  initialRevision = 0,
  debounceMs = 250
): PresentationSaveCoordinator {
  let state: PresentationSaveState = {
    status: 'saved',
    scheduledRevision: initialRevision,
    persistedRevision: initialRevision,
    error: null,
    mirrorWarnings: []
  }
  let nextRevision = initialRevision
  let pendingRequest: PresentationSaveRequest | null = null
  let latestRequest: PresentationSaveRequest | null = null
  let inFlight: Promise<void> | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastPersistedDocument = initialDocument
  let lastError: Error | null = null
  let generation = 0
  let disposed = false
  const listeners = new Set<(next: PresentationSaveState) => void>()

  const publish = (next: PresentationSaveState): void => {
    state = next
    if (disposed) return
    for (const listener of listeners) listener(state)
  }

  const clearDebounce = (): void => {
    if (debounceTimer === null) return
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  const runPending = (): Promise<void> => {
    if (inFlight) return inFlight
    const request = pendingRequest
    if (!request) return Promise.resolve()

    pendingRequest = null
    const runGeneration = generation
    publish({ ...state, status: 'saving', error: null })

    const operation = Promise.resolve()
      .then(() => persist(request))
      .then(
        (result) => {
          if (runGeneration !== generation) return
          lastPersistedDocument = request.document
          lastError = null
          publish({
            ...state,
            status:
              pendingRequest || result.revision !== state.scheduledRevision ? 'dirty' : 'saved',
            persistedRevision: result.revision,
            error: null,
            mirrorWarnings: result.mirrorWarnings
          })
        },
        (error: unknown) => {
          if (runGeneration !== generation) return
          lastError = normalizeError(error)
          publish({
            ...state,
            status: 'error',
            error: lastError.message
          })
        }
      )
      .finally(() => {
        if (inFlight === operation) inFlight = null
      })

    inFlight = operation
    void operation.then(() => {
      if (
        !disposed &&
        runGeneration === generation &&
        lastError === null &&
        pendingRequest !== null
      ) {
        void runPending()
      }
    })
    return operation
  }

  const armDebounce = (): void => {
    clearDebounce()
    if (inFlight) return
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void runPending()
    }, debounceMs)
  }

  const schedule = (document: EditablePresentationDocument, catalogName?: string): number => {
    nextRevision += 1
    const request: PresentationSaveRequest = {
      revision: nextRevision,
      document,
      catalogName
    }
    latestRequest = request
    pendingRequest = request
    lastError = null
    publish({
      ...state,
      status: 'dirty',
      scheduledRevision: request.revision,
      error: null
    })
    armDebounce()
    return request.revision
  }

  const flush = async (): Promise<void> => {
    clearDebounce()
    while (inFlight || pendingRequest) {
      if (inFlight) {
        await inFlight
      } else {
        await runPending()
      }
      if (lastError && !pendingRequest) break
    }
    if (state.persistedRevision !== state.scheduledRevision) {
      throw lastError ?? new Error('Latest presentation revision was not persisted')
    }
  }

  const retry = (): void => {
    if (
      !latestRequest ||
      (state.persistedRevision === state.scheduledRevision && state.mirrorWarnings.length === 0)
    ) {
      return
    }
    clearDebounce()
    pendingRequest = latestRequest
    lastError = null
    publish({ ...state, status: 'dirty', error: null })
    void runPending()
  }

  const discard = async (): Promise<void> => {
    clearDebounce()
    pendingRequest = null
    const activeWrite = inFlight
    if (activeWrite) await activeWrite
    pendingRequest = null
    generation += 1
    latestRequest = null
    lastError = null
    publish({
      ...state,
      status: 'saved',
      scheduledRevision: state.persistedRevision,
      error: null
    })
  }

  return {
    schedule,
    retry,
    flush,
    discard,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getState: () => state,
    getLastPersistedDocument: () => lastPersistedDocument,
    dispose: () => {
      if (disposed) return
      disposed = true
      clearDebounce()
      pendingRequest = null
      generation += 1
      listeners.clear()
    }
  }
}
