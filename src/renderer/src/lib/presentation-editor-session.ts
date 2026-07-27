import type { EditablePresentationDocument } from './editable-presentation'
import {
  commitPresentationDocument,
  redoPresentationDocument,
  undoPresentationDocument,
  type PresentationHistoryState
} from './presentation-history'
import {
  createPresentationSaveCoordinator,
  type PersistPresentationRevision,
  type PresentationSaveState
} from './presentation-save-coordinator'

export type PresentationDraftKind = 'pointer' | 'text'

export interface PresentationSessionSnapshot {
  history: PresentationHistoryState
  save: PresentationSaveState
  draftKind: PresentationDraftKind | null
  renderedDocument: EditablePresentationDocument
}

export interface PresentationEditorSession {
  getSnapshot(): PresentationSessionSnapshot
  subscribe(listener: () => void): () => void
  commit(next: EditablePresentationDocument): void
  undo(): void
  redo(): void
  beginDraft(kind: PresentationDraftKind): void
  previewDraft(next: EditablePresentationDocument): void
  commitDraft(): void
  cancelDraft(): void
  rename(nextName: string, catalogName: string): void
  flush(): Promise<void>
  retry(): void
  discard(): Promise<void>
  dispose(): void
}

interface PresentationDraft {
  kind: PresentationDraftKind
  preview: EditablePresentationDocument
}

export function createPresentationEditorSession(options: {
  initialDocument: EditablePresentationDocument
  initialRevision?: number
  persist: PersistPresentationRevision
  refreshThumbnail: (document: EditablePresentationDocument) => Promise<void>
}): PresentationEditorSession {
  let history: PresentationHistoryState = {
    past: [],
    present: options.initialDocument,
    future: []
  }
  let draft: PresentationDraft | null = null
  let thumbnailRevision = 0
  let thumbnailInFlightRevision: number | null = null
  let thumbnailFailedRevision: number | null = null
  let thumbnailWarning = false
  let thumbnailGeneration = 0
  let suppressCoordinatorNotifications = false
  let disposed = false
  const listeners = new Set<() => void>()
  const coordinator = createPresentationSaveCoordinator(
    options.initialDocument,
    options.persist,
    options.initialRevision
  )

  const getSaveSnapshot = (): PresentationSaveState => {
    const save = coordinator.getState()
    const mirrorWarnings = [...save.mirrorWarnings]
    if (thumbnailWarning && !mirrorWarnings.includes('thumbnail')) {
      mirrorWarnings.push('thumbnail')
    }
    return { ...save, mirrorWarnings }
  }

  const createSnapshot = (): PresentationSessionSnapshot => ({
    history,
    save: getSaveSnapshot(),
    draftKind: draft?.kind ?? null,
    renderedDocument: draft?.preview ?? history.present
  })

  let snapshot = createSnapshot()

  const emit = (): void => {
    if (disposed) return
    snapshot = createSnapshot()
    for (const listener of listeners) listener()
  }

  const maybeRefreshThumbnail = (force = false): void => {
    if (disposed || thumbnailInFlightRevision !== null) return
    const save = coordinator.getState()
    if (
      save.status !== 'saved' ||
      save.persistedRevision !== save.scheduledRevision ||
      save.persistedRevision <= thumbnailRevision ||
      (!force && thumbnailFailedRevision === save.persistedRevision)
    ) {
      return
    }

    const revision = save.persistedRevision
    const document = history.present
    const runGeneration = thumbnailGeneration
    thumbnailInFlightRevision = revision
    let refresh: Promise<void>
    try {
      refresh = options.refreshThumbnail(document)
    } catch (error) {
      refresh = Promise.reject(error)
    }
    void refresh.then(
      () => {
        if (disposed || runGeneration !== thumbnailGeneration) return
        thumbnailRevision = Math.max(thumbnailRevision, revision)
        if (thumbnailFailedRevision === revision) thumbnailFailedRevision = null
        thumbnailWarning = coordinator.getState().scheduledRevision > thumbnailRevision
        thumbnailInFlightRevision = null
        emit()
        maybeRefreshThumbnail()
      },
      () => {
        if (disposed || runGeneration !== thumbnailGeneration) return
        thumbnailFailedRevision = revision
        thumbnailWarning = true
        thumbnailInFlightRevision = null
        emit()
      }
    )
  }

  const unsubscribeCoordinator = coordinator.subscribe(() => {
    if (disposed || suppressCoordinatorNotifications) return
    const save = coordinator.getState()
    if (thumbnailInFlightRevision !== null && save.scheduledRevision > thumbnailInFlightRevision) {
      thumbnailWarning = true
    }
    emit()
    maybeRefreshThumbnail()
  })

  const schedule = (document: EditablePresentationDocument, catalogName?: string): void => {
    suppressCoordinatorNotifications = true
    try {
      const revision = coordinator.schedule(document, catalogName)
      if (thumbnailInFlightRevision !== null && revision > thumbnailInFlightRevision) {
        thumbnailWarning = true
      }
    } finally {
      suppressCoordinatorNotifications = false
    }
    emit()
  }

  const commitDraft = (): void => {
    if (!draft) return
    const next = draft.preview
    draft = null
    const nextHistory = commitPresentationDocument(history, next)
    if (nextHistory === history) {
      emit()
      return
    }
    history = nextHistory
    schedule(history.present)
  }

  const cancelDraft = (): void => {
    if (!draft) return
    draft = null
    emit()
  }

  const commit = (next: EditablePresentationDocument): void => {
    commitDraft()
    const nextHistory = commitPresentationDocument(history, next)
    if (nextHistory === history) return
    history = nextHistory
    schedule(history.present)
  }

  const moveHistory = (
    move: (state: PresentationHistoryState) => PresentationHistoryState
  ): void => {
    commitDraft()
    const nextHistory = move(history)
    if (nextHistory === history) return
    history = nextHistory
    schedule(history.present)
  }

  const renameDocument = (
    document: EditablePresentationDocument,
    nextName: string,
    updatedAt: number
  ): EditablePresentationDocument => ({
    ...document,
    name: nextName,
    updatedAt
  })

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    commit,
    undo: () => moveHistory(undoPresentationDocument),
    redo: () => moveHistory(redoPresentationDocument),
    beginDraft: (kind) => {
      if (draft?.kind === kind) return
      commitDraft()
      draft = { kind, preview: history.present }
      emit()
    },
    previewDraft: (next) => {
      if (!draft) throw new Error('Presentation draft has not started')
      draft = { ...draft, preview: next }
      emit()
    },
    commitDraft,
    cancelDraft,
    rename: (nextName, catalogName) => {
      commitDraft()
      const updatedAt = Date.now()
      history = {
        past: history.past.map((document) => renameDocument(document, nextName, updatedAt)),
        present: renameDocument(history.present, nextName, updatedAt),
        future: history.future.map((document) => renameDocument(document, nextName, updatedAt))
      }
      schedule(history.present, catalogName)
    },
    flush: async () => {
      commitDraft()
      await coordinator.flush()
    },
    retry: () => {
      const save = coordinator.getState()
      if (save.status === 'error' || save.mirrorWarnings.length > 0) {
        coordinator.retry()
      }
      if (thumbnailWarning) {
        thumbnailFailedRevision = null
        maybeRefreshThumbnail(true)
      }
    },
    discard: async () => {
      suppressCoordinatorNotifications = true
      try {
        draft = null
        await coordinator.discard()
        history = {
          past: [],
          present: coordinator.getLastPersistedDocument(),
          future: []
        }
        thumbnailGeneration += 1
        thumbnailInFlightRevision = null
        thumbnailFailedRevision = null
        thumbnailWarning = false
        thumbnailRevision = coordinator.getState().persistedRevision
      } finally {
        suppressCoordinatorNotifications = false
      }
      emit()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      thumbnailGeneration += 1
      unsubscribeCoordinator()
      coordinator.dispose()
      listeners.clear()
    }
  }
}
