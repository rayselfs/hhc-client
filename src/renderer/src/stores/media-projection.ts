import { create } from 'zustand'
import type { FileItemRecord } from '@shared/types/folder'
import type { MediaType, MediaTypeStateMap } from '@renderer/lib/presentability'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { lockMediaResources } from '@renderer/lib/media-resource-locks'
import {
  analyzePresentationReadiness,
  createPresentationSnapshot,
  getPresentationSnapshotResourceIds,
  type PresentationReadinessReport,
  type PresentationSnapshot
} from '@renderer/lib/presentation-readiness'
import { getReadyTranscodedVideo } from '@renderer/lib/media-transcode-lifecycle'

export interface MediaProjectionStore {
  playlist: FileItemRecord[]
  currentIndex: number
  isPresenting: boolean
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

  startPresentation: (files: FileItemRecord[], startIndex: number) => void
  exit: () => void
  next: () => void
  prev: () => void
  jumpTo: (index: number) => void
  toggleGrid: () => void
  getTypeState: <K extends MediaType>(type: K) => MediaTypeStateMap[K] | undefined
  setTypeState: <K extends MediaType>(type: K, value: MediaTypeStateMap[K]) => void
  setZoomLevel: (level: number) => void
  resetZoom: () => void
  setPan: (x: number, y: number) => void
  updateNotes: (itemId: string, notes: string) => void
  startPresentationWithReadiness: (
    files: FileItemRecord[],
    startIndex: number
  ) => Promise<PresentationReadinessReport>
  upgradeReadyTranscodedItems: () => Promise<void>
}

const initialTypeStates: Partial<{ [K in MediaType]: MediaTypeStateMap[K] }> = {
  pdf: { viewMode: 'slide' as const, thumbsCollapsed: false }
}

const initialState = {
  playlist: [] as FileItemRecord[],
  currentIndex: 0,
  isPresenting: false,
  isEnded: false,
  showGrid: false,
  lastReadinessReport: null as PresentationReadinessReport | null,
  snapshot: null as PresentationSnapshot | null,
  typeStates: initialTypeStates,
  zoomLevel: 1,
  pan: { x: 0, y: 0 }
}

let releaseProjectionLocks: (() => void) | null = null

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
    const { currentIndex, playlist, isEnded } = get()
    return !isEnded && currentIndex < playlist.length - 1
  },

  canPrev: () => {
    const { currentIndex } = get()
    return currentIndex > 0
  },

  progress: () => {
    const { playlist, currentIndex } = get()
    if (playlist.length === 0) return '0 / 0'
    return `${currentIndex + 1} / ${playlist.length}`
  },

  startPresentation: (files: FileItemRecord[], startIndex: number) => {
    releaseProjectionLocks?.()
    const snapshot = createPresentationSnapshot(files)
    releaseProjectionLocks = lockMediaResources(getPresentationSnapshotResourceIds(snapshot))
    set({
      playlist: files,
      currentIndex: startIndex,
      isPresenting: true,
      lastReadinessReport: null,
      snapshot,
      typeStates: initialTypeStates
    })
  },

  startPresentationWithReadiness: async (
    files: FileItemRecord[],
    startIndex: number
  ): Promise<PresentationReadinessReport> => {
    const report = await analyzePresentationReadiness(files)
    const readyItemIds = new Set(
      report.items.filter((item) => item.status === 'ready').map((item) => item.itemId)
    )
    const readyFiles = files.filter((file) => readyItemIds.has(file.id))
    if (readyFiles.length === 0) {
      set({ lastReadinessReport: report })
      return report
    }

    const requestedItem = files[startIndex]
    const requestedReadyIndex = requestedItem
      ? readyFiles.findIndex((file) => file.id === requestedItem.id)
      : -1
    const fallbackReadyIndex = readyFiles.findIndex(
      (file) => files.findIndex((candidate) => candidate.id === file.id) >= startIndex
    )
    const resolvedIndex =
      requestedReadyIndex >= 0
        ? requestedReadyIndex
        : fallbackReadyIndex >= 0
          ? fallbackReadyIndex
          : readyFiles.length - 1

    releaseProjectionLocks?.()
    const snapshot = createPresentationSnapshot(readyFiles, report.items)
    releaseProjectionLocks = lockMediaResources(getPresentationSnapshotResourceIds(snapshot))
    set({
      playlist: readyFiles,
      currentIndex: resolvedIndex,
      isPresenting: true,
      lastReadinessReport: report,
      isEnded: false,
      showGrid: false,
      snapshot,
      typeStates: initialTypeStates,
      zoomLevel: 1,
      pan: { x: 0, y: 0 }
    })
    return report
  },

  exit: () => {
    releaseProjectionLocks?.()
    releaseProjectionLocks = null
    set({ ...initialState })
  },

  next: () => {
    const s = get()
    if (s.isEnded) {
      s.exit()
      return
    }
    if (s.currentIndex >= s.playlist.length - 1) {
      set({ isEnded: true })
      return
    }
    set({ currentIndex: s.currentIndex + 1, zoomLevel: 1, pan: { x: 0, y: 0 } })
  },

  prev: () => {
    const s = get()
    if (s.isEnded) {
      set({ isEnded: false })
      return
    }
    if (s.currentIndex <= 0) return
    set({ currentIndex: s.currentIndex - 1, zoomLevel: 1, pan: { x: 0, y: 0 } })
  },

  jumpTo: (index: number) => {
    const { playlist } = get()
    const clamped = Math.max(0, Math.min(index, playlist.length - 1))
    set({ currentIndex: clamped, isEnded: false, zoomLevel: 1, pan: { x: 0, y: 0 } })
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
  },

  upgradeReadyTranscodedItems: async () => {
    const state = get()
    if (!state.snapshot) return
    let changed = false
    const entries = await Promise.all(
      state.snapshot.entries.map(async (entry, index) => {
        if (index === state.currentIndex || entry.playbackMode === 'transcoded-derivative') {
          return entry
        }
        const ready = await getReadyTranscodedVideo(entry.blobId)
        if (!ready?.nativeFileId) return entry
        changed = true
        return {
          ...entry,
          derivativeId: ready.id,
          playbackMode: 'transcoded-derivative' as const,
          seekable: true
        }
      })
    )
    if (!changed) return
    const snapshot = { ...state.snapshot, entries }
    releaseProjectionLocks?.()
    releaseProjectionLocks = lockMediaResources(getPresentationSnapshotResourceIds(snapshot))
    set({ snapshot })
  }
}))
