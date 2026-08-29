import { create } from 'zustand'
import type { StoreApi } from 'zustand'
import type { FileItemRecord } from '@shared/types/folder'
import { getBlobId } from '@renderer/lib/blob-identity'
import { getMediaType, type MediaType, type MediaTypeStateMap } from '@renderer/lib/presentability'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { lockMediaResources } from '@renderer/lib/media-resource-locks'
import { prepareMediaProjection } from '@renderer/lib/media-projection-preflight'
import { isEditablePresentationMimeType } from '@renderer/lib/presentation-media'
import {
  analyzePresentationReadiness,
  createPresentationSnapshot,
  getPresentationSnapshotResourceIds,
  type PresentationReadinessReport,
  type PresentationSnapshot
} from '@renderer/lib/presentation-readiness'
import { ensureSyncItemAvailableForPresentation } from '@renderer/lib/cloud-provider'

interface StartPresentationWithReadinessOptions {
  prioritizeStartItem?: boolean
  presentationState?: MediaTypeStateMap['presentation']
}

export type MediaProjectionActionResult = boolean | Promise<boolean>

export interface MediaProjectionStore {
  playlist: FileItemRecord[]
  currentIndex: number
  isPresenting: boolean
  sessionRevision: number
  isEnded: boolean
  showGrid: boolean
  lastReadinessReport: PresentationReadinessReport | null
  snapshot: PresentationSnapshot | null
  typeStates: Partial<{ [K in MediaType]: MediaTypeStateMap[K] }>
  zoomLevel: number
  pan: { x: number; y: number }

  currentItem: () => FileItemRecord | null
  nextItem: () => FileItemRecord | null
  prevItem: () => FileItemRecord | null
  canNext: () => boolean
  canPrev: () => boolean
  progress: () => string

  startPresentation: (files: FileItemRecord[], startIndex: number) => MediaProjectionActionResult
  exit: () => void
  endLiveSession: () => void
  markProjectionClosed: () => void
  next: () => MediaProjectionActionResult
  prev: () => MediaProjectionActionResult
  jumpTo: (index: number) => MediaProjectionActionResult
  toggleGrid: () => void
  getTypeState: <K extends MediaType>(type: K) => MediaTypeStateMap[K] | undefined
  setTypeState: <K extends MediaType>(type: K, value: MediaTypeStateMap[K]) => void
  setZoomLevel: (level: number) => void
  resetZoom: () => void
  setPan: (x: number, y: number) => void
  updateNotes: (itemId: string, notes: string) => void
  startPresentationWithReadiness: (
    files: FileItemRecord[],
    startIndex: number,
    options?: StartPresentationWithReadinessOptions
  ) => Promise<PresentationReadinessReport>
}

const initialTypeStates: Partial<{ [K in MediaType]: MediaTypeStateMap[K] }> = {
  pdf: { viewMode: 'slide' as const, thumbsCollapsed: false }
}

const initialState = {
  playlist: [] as FileItemRecord[],
  currentIndex: 0,
  isPresenting: false,
  sessionRevision: 0,
  isEnded: false,
  showGrid: false,
  lastReadinessReport: null as PresentationReadinessReport | null,
  snapshot: null as PresentationSnapshot | null,
  typeStates: initialTypeStates,
  zoomLevel: 1,
  pan: { x: 0, y: 0 }
}

let releaseProjectionLocks: (() => void) | null = null
let projectionActionGeneration = 0

function beginProjectionAction(): number {
  projectionActionGeneration += 1
  return projectionActionGeneration
}

function isCurrentProjectionAction(generation: number): boolean {
  return generation === projectionActionGeneration
}

function clearLiveSession(set: StoreApi<MediaProjectionStore>['setState']): void {
  releaseProjectionLocks?.()
  releaseProjectionLocks = null
  set({ ...initialState })
}

function withoutTransientMediaRuntimeState(
  typeStates: MediaProjectionStore['typeStates']
): MediaProjectionStore['typeStates'] {
  const next = { ...typeStates }
  delete next.video
  delete next.presentation
  return next
}

function getCurrentPresentationState(
  state: Pick<MediaProjectionStore, 'playlist' | 'currentIndex' | 'typeStates'>
): MediaTypeStateMap['presentation'] | null {
  const item = state.playlist[state.currentIndex]
  if (!item || getMediaType(item.mimeType) !== 'presentation') return null
  return state.typeStates.presentation ?? { slideIndex: 0 }
}

function commitAfterPreflight(
  generation: number,
  result: boolean | Promise<boolean>,
  commit: () => void,
  isCurrent = (): boolean => true
): MediaProjectionActionResult {
  const canCommit = (): boolean => isCurrentProjectionAction(generation) && isCurrent()
  if (typeof result === 'boolean') {
    if (!result || !canCommit()) return false
    commit()
    return true
  }
  return result.then(
    (ready) => {
      if (!ready || !canCommit()) return false
      commit()
      return true
    },
    () => false
  )
}

function editablePreflightItems(
  ...items: Array<FileItemRecord | null | undefined>
): FileItemRecord[] {
  return items.filter(
    (item, index, values): item is FileItemRecord =>
      item !== null &&
      item !== undefined &&
      isEditablePresentationMimeType(item.mimeType) &&
      values.indexOf(item) === index
  )
}

function prepareEditableProjection(
  ...items: Array<FileItemRecord | null | undefined>
): boolean | Promise<boolean> {
  const editableItems = editablePreflightItems(...items)
  return editableItems.length > 0 ? prepareMediaProjection(editableItems) : true
}

function isSameNavigationState(
  state: MediaProjectionStore,
  get: StoreApi<MediaProjectionStore>['getState']
): boolean {
  const current = get()
  return (
    current.playlist === state.playlist &&
    current.currentIndex === state.currentIndex &&
    current.isPresenting === state.isPresenting &&
    current.isEnded === state.isEnded &&
    current.sessionRevision === state.sessionRevision
  )
}

function blockedReadinessReport(
  item: FileItemRecord | undefined,
  reason: 'presentation-finalization-blocked' | 'presentation-projection-superseded'
): PresentationReadinessReport {
  return {
    summary: { ready: 0, preparing: 0, unsupported: 0, missing: 0, failed: 1 },
    items: item
      ? [
          {
            itemId: item.id,
            blobId: getBlobId(item),
            status: 'failed',
            reason,
            support: null
          }
        ]
      : []
  }
}

export const useMediaProjectionStore = create<MediaProjectionStore>()((set, get) => ({
  ...initialState,

  currentItem: () => {
    const { playlist, currentIndex } = get()
    return playlist[currentIndex] ?? null
  },

  nextItem: () => {
    const { playlist, currentIndex } = get()
    return playlist[currentIndex + 1] ?? null
  },

  prevItem: () => {
    const { playlist, currentIndex } = get()
    return playlist[currentIndex - 1] ?? null
  },

  canNext: () => {
    const { playlist, isEnded } = get()
    return !isEnded && playlist.length > 0
  },

  canPrev: () => {
    const state = get()
    const { currentIndex } = state
    const presentation = getCurrentPresentationState(state)
    if (presentation && presentation.slideIndex > 0) return true
    return currentIndex > 0
  },

  progress: () => {
    const state = get()
    const { playlist, currentIndex } = state
    const presentation = getCurrentPresentationState(state)
    if (presentation?.slideCount !== undefined && presentation.slideCount > 0) {
      return `${presentation.slideIndex + 1} / ${presentation.slideCount}`
    }
    if (playlist.length === 0) return '0 / 0'
    return `${currentIndex + 1} / ${playlist.length}`
  },

  startPresentation: (files: FileItemRecord[], startIndex: number) => {
    const generation = beginProjectionAction()
    return commitAfterPreflight(generation, prepareEditableProjection(files[startIndex]), () => {
      releaseProjectionLocks?.()
      const snapshot = createPresentationSnapshot(files)
      releaseProjectionLocks = lockMediaResources(getPresentationSnapshotResourceIds(snapshot))
      set({
        playlist: files,
        currentIndex: startIndex,
        isPresenting: true,
        sessionRevision: get().sessionRevision + 1,
        lastReadinessReport: null,
        snapshot,
        typeStates: initialTypeStates
      })
    })
  },

  startPresentationWithReadiness: async (
    files: FileItemRecord[],
    startIndex: number,
    options: StartPresentationWithReadinessOptions = {}
  ): Promise<PresentationReadinessReport> => {
    const generation = beginProjectionAction()
    const requestedItem = files[startIndex]
    let report = await analyzePresentationReadiness(files)
    if (!isCurrentProjectionAction(generation)) {
      return blockedReadinessReport(requestedItem, 'presentation-projection-superseded')
    }
    if (options.prioritizeStartItem && requestedItem) {
      const requestedReadiness = report.items.find((item) => item.itemId === requestedItem.id)
      if (
        requestedReadiness?.status === 'preparing' &&
        requestedReadiness.reason.startsWith('sync-') &&
        (await ensureSyncItemAvailableForPresentation(requestedItem))
      ) {
        report = await analyzePresentationReadiness(files)
        if (!isCurrentProjectionAction(generation)) {
          return blockedReadinessReport(requestedItem, 'presentation-projection-superseded')
        }
      }
    }

    const readyItemIds = new Set(
      report.items.filter((item) => item.status === 'ready').map((item) => item.itemId)
    )
    const readyFiles = files.filter((file) => readyItemIds.has(file.id))
    const requestedReadyIndex = requestedItem
      ? readyFiles.findIndex((file) => file.id === requestedItem.id)
      : -1
    if (options.prioritizeStartItem && requestedItem && requestedReadyIndex === -1) {
      if (!isCurrentProjectionAction(generation)) {
        return blockedReadinessReport(requestedItem, 'presentation-projection-superseded')
      }
      set({ lastReadinessReport: report })
      return report
    }
    if (readyFiles.length === 0) {
      if (!isCurrentProjectionAction(generation)) {
        return blockedReadinessReport(requestedItem, 'presentation-projection-superseded')
      }
      set({ lastReadinessReport: report })
      return report
    }

    const fallbackReadyIndex = readyFiles.findIndex(
      (file) => files.findIndex((candidate) => candidate.id === file.id) >= startIndex
    )
    const resolvedIndex =
      requestedReadyIndex >= 0
        ? requestedReadyIndex
        : fallbackReadyIndex >= 0
          ? fallbackReadyIndex
          : readyFiles.length - 1

    if (!(await prepareEditableProjection(readyFiles[resolvedIndex]))) {
      return blockedReadinessReport(readyFiles[resolvedIndex], 'presentation-finalization-blocked')
    }
    if (!isCurrentProjectionAction(generation)) {
      return blockedReadinessReport(readyFiles[resolvedIndex], 'presentation-projection-superseded')
    }

    releaseProjectionLocks?.()
    const snapshot = createPresentationSnapshot(readyFiles, report.items)
    releaseProjectionLocks = lockMediaResources(getPresentationSnapshotResourceIds(snapshot))
    set({
      playlist: readyFiles,
      currentIndex: resolvedIndex,
      isPresenting: true,
      sessionRevision: get().sessionRevision + 1,
      lastReadinessReport: report,
      isEnded: false,
      showGrid: false,
      snapshot,
      typeStates: options.presentationState
        ? { ...initialTypeStates, presentation: options.presentationState }
        : initialTypeStates,
      zoomLevel: 1,
      pan: { x: 0, y: 0 }
    })
    return report
  },

  exit: () => {
    beginProjectionAction()
    clearLiveSession(set)
  },

  endLiveSession: () => {
    beginProjectionAction()
    clearLiveSession(set)
  },

  markProjectionClosed: () => {
    beginProjectionAction()
    clearLiveSession(set)
  },

  next: () => {
    const generation = beginProjectionAction()
    const s = get()
    if (s.isEnded) return false
    const presentation = getCurrentPresentationState(s)
    if (
      presentation &&
      presentation.slideCount !== undefined &&
      presentation.slideIndex < presentation.slideCount - 1
    ) {
      return commitAfterPreflight(
        generation,
        prepareEditableProjection(s.currentItem()),
        () => {
          set({
            typeStates: {
              ...s.typeStates,
              presentation: {
                ...presentation,
                slideIndex: presentation.slideIndex + 1
              }
            }
          })
        },
        () => isSameNavigationState(s, get)
      )
    }
    if (s.currentIndex >= s.playlist.length - 1) {
      return commitAfterPreflight(
        generation,
        prepareEditableProjection(s.currentItem()),
        () => {
          set({ isEnded: true })
        },
        () => isSameNavigationState(s, get)
      )
    }
    return commitAfterPreflight(
      generation,
      prepareEditableProjection(s.currentItem(), s.nextItem()),
      () => {
        set({
          currentIndex: s.currentIndex + 1,
          zoomLevel: 1,
          pan: { x: 0, y: 0 },
          typeStates: withoutTransientMediaRuntimeState(s.typeStates)
        })
      },
      () => isSameNavigationState(s, get)
    )
  },

  prev: () => {
    const generation = beginProjectionAction()
    const s = get()
    if (s.isEnded) {
      return commitAfterPreflight(
        generation,
        prepareEditableProjection(s.currentItem()),
        () => {
          set({ isEnded: false })
        },
        () => isSameNavigationState(s, get)
      )
    }
    const presentation = getCurrentPresentationState(s)
    if (presentation && presentation.slideIndex > 0) {
      return commitAfterPreflight(
        generation,
        prepareEditableProjection(s.currentItem()),
        () => {
          set({
            typeStates: {
              ...s.typeStates,
              presentation: {
                ...presentation,
                slideIndex: presentation.slideIndex - 1
              }
            }
          })
        },
        () => isSameNavigationState(s, get)
      )
    }
    if (s.currentIndex <= 0) return false
    return commitAfterPreflight(
      generation,
      prepareEditableProjection(s.currentItem(), s.prevItem()),
      () => {
        set({
          currentIndex: s.currentIndex - 1,
          zoomLevel: 1,
          pan: { x: 0, y: 0 },
          typeStates: withoutTransientMediaRuntimeState(s.typeStates)
        })
      },
      () => isSameNavigationState(s, get)
    )
  },

  jumpTo: (index: number) => {
    const generation = beginProjectionAction()
    const s = get()
    const clamped = Math.max(0, Math.min(index, s.playlist.length - 1))
    return commitAfterPreflight(
      generation,
      prepareEditableProjection(s.currentItem(), s.playlist[clamped]),
      () => {
        set({
          currentIndex: clamped,
          isEnded: false,
          zoomLevel: 1,
          pan: { x: 0, y: 0 },
          typeStates:
            clamped === s.currentIndex
              ? s.typeStates
              : withoutTransientMediaRuntimeState(s.typeStates)
        })
      },
      () => isSameNavigationState(s, get)
    )
  },

  toggleGrid: () => {
    set((state) => ({ showGrid: !state.showGrid }))
  },

  getTypeState: <K extends MediaType>(type: K) => {
    return get().typeStates[type] as MediaTypeStateMap[K] | undefined
  },

  setTypeState: <K extends MediaType>(type: K, value: MediaTypeStateMap[K]) => {
    set((s) => ({
      typeStates: { ...s.typeStates, [type]: value } as Partial<{
        [T in MediaType]: MediaTypeStateMap[T]
      }>
    }))
  },

  setZoomLevel: (level: number) => {
    if (level <= 1) {
      set({ zoomLevel: 1, pan: { x: 0, y: 0 } })
    } else {
      set({ zoomLevel: level })
    }
  },

  resetZoom: () => {
    set({ zoomLevel: 1, pan: { x: 0, y: 0 } })
  },

  setPan: (x: number, y: number) => {
    set({ pan: { x, y } })
  },

  updateNotes: (itemId: string, notes: string) => {
    const store = useFileExplorerStore.getState()
    if (store.updateItem) store.updateItem(itemId, { notes })
    set((state) => {
      const idx = state.playlist.findIndex((item) => item.id === itemId)
      if (idx === -1) return {}
      const newPlaylist = [...state.playlist]
      newPlaylist[idx] = { ...newPlaylist[idx], notes }
      return { playlist: newPlaylist }
    })
  }
}))
