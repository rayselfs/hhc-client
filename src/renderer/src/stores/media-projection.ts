import { create } from 'zustand'
import type { FileItemRecord } from '@shared/types/folder'
import type { MediaType, MediaTypeStateMap } from '@renderer/lib/presentability'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { lockMediaResources } from '@renderer/lib/media-resource-locks'
import {
  createPresentationSnapshot,
  getPresentationSnapshotResourceIds,
  type PresentationSnapshot
} from '@renderer/lib/presentation-readiness'

export interface MediaProjectionStore {
  playlist: FileItemRecord[]
  currentIndex: number
  isPresenting: boolean
  isEnded: boolean
  showGrid: boolean
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
      snapshot,
      typeStates: initialTypeStates
    })
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
  }
}))
