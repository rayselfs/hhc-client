import { create } from 'zustand'
import type { FileItemRecord } from '@shared/types/folder'
import type { MediaType, MediaTypeStateMap } from '@renderer/lib/presentability'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { getThumbnail, saveThumbnail } from '@renderer/lib/thumbnail-db'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { getFileBlob, openFileExplorerDB } from '@renderer/lib/file-explorer-db'

export interface MediaProjectionStore {
  playlist: FileItemRecord[]
  currentIndex: number
  isPresenting: boolean
  showGrid: boolean
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
  pdf: { viewMode: 'slide' as const }
}

const initialState = {
  playlist: [] as FileItemRecord[],
  currentIndex: 0,
  isPresenting: false,
  showGrid: false,
  typeStates: initialTypeStates,
  zoomLevel: 1,
  pan: { x: 0, y: 0 }
}

let preGenAbortController: AbortController | null = null

function createSemaphore(limit: number): { acquire(): Promise<() => void> } {
  let active = 0
  const queue: Array<() => void> = []

  return {
    acquire(): Promise<() => void> {
      return new Promise((resolve) => {
        const tryAcquire = (): void => {
          if (active < limit) {
            active++
            resolve(() => {
              active--
              queue.shift()?.()
            })
            return
          }

          queue.push(tryAcquire)
        }

        tryAcquire()
      })
    }
  }
}

async function preGenerateThumbnails(
  items: FileItemRecord[],
  signal: AbortSignal
): Promise<void> {
  const semaphore = createSemaphore(3)

  await Promise.all(
    items.map(async (item) => {
      if (signal.aborted) return

      const release = await semaphore.acquire()
      try {
        if (signal.aborted) return

        const existing = await getThumbnail(item.id)
        if (existing || signal.aborted) return

        const db = await openFileExplorerDB()
        if (signal.aborted) return

        const blob = await getFileBlob(db, item.id)
        if (!blob || signal.aborted) return

        const file = new File([blob], item.name, { type: item.mimeType })
        const dataUrl = await generateThumbnail(file)
        if (!dataUrl || signal.aborted) return

        await saveThumbnail(item.id, dataUrl)
        if (signal.aborted) return

        window.dispatchEvent(
          new CustomEvent('hhc:thumbnail-ready', { detail: { itemId: item.id, dataUrl } })
        )
      } finally {
        release()
      }
    })
  )
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
    preGenAbortController?.abort()
    preGenAbortController = new AbortController()
    set({ playlist: files, currentIndex: startIndex, isPresenting: true, typeStates: initialTypeStates })
    void preGenerateThumbnails(files, preGenAbortController.signal)
  },

  exit: () => {
    preGenAbortController?.abort()
    preGenAbortController = null
    set({ ...initialState })
  },

  next: () => {
    const s = get()
    if (!s.canNext()) return
    set({ currentIndex: s.currentIndex + 1, zoomLevel: 1, pan: { x: 0, y: 0 } })
  },

  prev: () => {
    const s = get()
    if (!s.canPrev()) return
    set({ currentIndex: s.currentIndex - 1, zoomLevel: 1, pan: { x: 0, y: 0 } })
  },

  jumpTo: (index: number) => {
    const { playlist } = get()
    const clamped = Math.max(0, Math.min(index, playlist.length - 1))
    set({ currentIndex: clamped, zoomLevel: 1, pan: { x: 0, y: 0 } })
  },

  toggleGrid: () => {
    set((state) => ({ showGrid: !state.showGrid }))
  },

  getTypeState: <K extends MediaType>(type: K) => {
    return get().typeStates[type] as MediaTypeStateMap[K] | undefined
  },

  setTypeState: <K extends MediaType>(type: K, value: MediaTypeStateMap[K]) => {
    set((s) => ({
      typeStates: { ...s.typeStates, [type]: value } as Partial<{ [T in MediaType]: MediaTypeStateMap[T] }>
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
