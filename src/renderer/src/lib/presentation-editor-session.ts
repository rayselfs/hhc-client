import { updateElementInSlide } from './editable-presentation'
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

export type PresentationDraftKind = 'pointer' | 'text' | 'notes'

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
  reflowText(slideId: string, elementId: string, size: { width?: number; height?: number }): void
  undo(): void
  redo(): void
  beginDraft(kind: PresentationDraftKind): void
  previewDraft(next: EditablePresentationDocument): boolean
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

function hasSameCover(a: EditablePresentationDocument, b: EditablePresentationDocument): boolean {
  const id = a.slideOrder[0]
  if (id !== b.slideOrder[0] || a.width !== b.width || a.height !== b.height) return false
  const before = a.slides[id]
  const after = b.slides[id]
  if (!before || !after) return before === after
  if (
    before.background !== after.background ||
    before.elementOrder.length !== after.elementOrder.length
  )
    return false
  return before.elementOrder.every((elementId, index) => {
    if (elementId !== after.elementOrder[index]) return false
    const element = before.elements[elementId]
    if (element !== after.elements[elementId]) return false
    return !('assetId' in element) || a.assets[element.assetId] === b.assets[element.assetId]
  })
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
  let thumbnailDocument = options.initialDocument
  let thumbnailRevision = options.initialRevision ?? 0
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
    if (hasSameCover(thumbnailDocument, document)) {
      thumbnailRevision = revision
      thumbnailWarning = false
      thumbnailFailedRevision = null
      emit()
      return
    }
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
        thumbnailDocument = document
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
    reflowText: (slideId, elementId, size) => {
      const current = draft?.preview ?? history.present
      const element = current.slides[slideId]?.elements[elementId]
      if (element?.type !== 'text') return
      const dimensions = Object.fromEntries(
        Object.entries(size).filter(
          ([key, value]) =>
            (key === 'width' || key === 'height') &&
            Number.isFinite(value) &&
            value > 0 &&
            Math.abs(element[key] - value) >= 1
        )
      )
      if (!Object.keys(dimensions).length) return
      const next = updateElementInSlide(current, slideId, elementId, dimensions)
      if (draft) {
        draft = { ...draft, preview: next }
        emit()
      } else {
        history = { ...history, present: next }
        schedule(next)
      }
    },
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
      return next !== history.present
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
        thumbnailFailedRevision = null
      } finally {
        suppressCoordinatorNotifications = false
      }
      emit()
      maybeRefreshThumbnail()
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
