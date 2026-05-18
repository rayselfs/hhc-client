import { create } from 'zustand'
import type { FileItemRecord } from '@shared/types/folder'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'

export type PdfViewMode = 'slide' | 'scroll'

export interface MediaProjectionStore {
  playlist: FileItemRecord[]
  currentIndex: number
  isPresenting: boolean
  showGrid: boolean
  pdfViewMode: PdfViewMode
  zoomLevel: number

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
  setPdfViewMode: (mode: PdfViewMode) => void
  setZoomLevel: (level: number) => void
  resetZoom: () => void
  updateNotes: (itemId: string, notes: string) => void
}

const initialState = {
  playlist: [] as FileItemRecord[],
  currentIndex: 0,
  isPresenting: false,
  showGrid: false,
  pdfViewMode: 'slide' as PdfViewMode,
  zoomLevel: 1
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
    const { playlist, currentIndex } = get()
    return currentIndex < playlist.length - 1
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
    set({ playlist: files, currentIndex: startIndex, isPresenting: true })
  },

  exit: () => {
    set({ ...initialState })
  },

  next: () => {
    const s = get()
    if (!s.canNext()) return
    set({ currentIndex: s.currentIndex + 1 })
  },

  prev: () => {
    const s = get()
    if (!s.canPrev()) return
    set({ currentIndex: s.currentIndex - 1 })
  },

  jumpTo: (index: number) => {
    const { playlist } = get()
    const clamped = Math.max(0, Math.min(index, playlist.length - 1))
    set({ currentIndex: clamped })
  },

  toggleGrid: () => {
    set((state) => ({ showGrid: !state.showGrid }))
  },

  setPdfViewMode: (mode: PdfViewMode) => {
    set({ pdfViewMode: mode })
  },

  setZoomLevel: (level: number) => {
    set({ zoomLevel: level })
  },

  resetZoom: () => {
    set({ zoomLevel: 1 })
  },

  updateNotes: (itemId: string, notes: string) => {
    const store = useFileExplorerStore.getState()
    if (!store.updateItem) return
    store.updateItem(itemId, { notes })
    set((state) => ({
      playlist: state.playlist.map((item) =>
        item.id === itemId ? { ...item, notes } : item
      )
    }))
  }
}))
