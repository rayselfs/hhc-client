import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'

export type ServiceCueType = 'media' | 'bible' | 'timer' | 'slide' | 'placeholder'

interface ServiceCueBase {
  id: string
  type: ServiceCueType
  title: string
  notes?: string
  completed: boolean
  createdAt: number
  updatedAt: number
}

export interface MediaServiceCue extends ServiceCueBase {
  type: 'media'
  fileItemId: string
  fileName: string
}

export interface BibleServiceCue extends ServiceCueBase {
  type: 'bible'
  bookNumber: number
  chapter: number
  verse?: number
  reference: string
}

export interface TimerServiceCue extends ServiceCueBase {
  type: 'timer'
  mode: 'timer' | 'stopwatch'
  durationSeconds?: number
}

export interface SlideServiceCue extends ServiceCueBase {
  type: 'slide'
  documentId: string
  slideId: string
  documentTitle: string
  slideTitle: string
}

export interface PlaceholderServiceCue extends ServiceCueBase {
  type: 'placeholder'
  sourceType: 'slide' | 'song'
}

export type ServiceCue =
  | MediaServiceCue
  | BibleServiceCue
  | TimerServiceCue
  | SlideServiceCue
  | PlaceholderServiceCue

type GeneratedCueFields = 'id' | 'completed' | 'createdAt' | 'updatedAt'

type CreateCueInput =
  | Omit<MediaServiceCue, GeneratedCueFields>
  | Omit<BibleServiceCue, GeneratedCueFields>
  | Omit<TimerServiceCue, GeneratedCueFields>
  | Omit<SlideServiceCue, GeneratedCueFields>
  | Omit<PlaceholderServiceCue, GeneratedCueFields>

interface ServicePlaylistState {
  cues: ServiceCue[]
  currentCueId: string | null
  selectedCueId: string | null
  previewCueId: string | null

  currentCue: () => ServiceCue | null
  selectedCue: () => ServiceCue | null
  previewCue: () => ServiceCue | null
  nextCue: () => ServiceCue | null

  addCue: (input: CreateCueInput) => string
  updateCue: (id: string, patch: Partial<Pick<ServiceCue, 'title' | 'notes'>>) => void
  removeCue: (id: string) => void
  duplicateCue: (id: string) => string | null
  reorderCue: (fromIndex: number, toIndex: number) => void
  jumpToCue: (id: string) => void
  selectCue: (id: string | null) => void
  previewCueById: (id: string | null) => void
  markComplete: (id: string, completed?: boolean) => void
  clear: () => void
}

const initialState = {
  cues: [] as ServiceCue[],
  currentCueId: null as string | null,
  selectedCueId: null as string | null,
  previewCueId: null as string | null
}

function createId(): string {
  return crypto.randomUUID()
}

function cloneCue(cue: ServiceCue, now: number): ServiceCue {
  return {
    ...cue,
    id: createId(),
    title: `${cue.title} Copy`,
    completed: false,
    createdAt: now,
    updatedAt: now
  }
}

function makeCue(input: CreateCueInput): ServiceCue {
  const now = Date.now()
  return {
    ...input,
    id: createId(),
    title: input.title,
    completed: false,
    createdAt: now,
    updatedAt: now
  } as ServiceCue
}

function removeCueId(state: ServicePlaylistState, id: string): Partial<ServicePlaylistState> {
  const cues = state.cues.filter((cue) => cue.id !== id)
  const wasCurrent = state.currentCueId === id
  const currentCueId = wasCurrent ? (cues[0]?.id ?? null) : state.currentCueId
  return {
    cues,
    currentCueId,
    selectedCueId: state.selectedCueId === id ? currentCueId : state.selectedCueId,
    previewCueId: state.previewCueId === id ? null : state.previewCueId
  }
}

export const useServicePlaylistStore = create<ServicePlaylistState>()(
  persist(
    (set, get) => ({
      ...initialState,

      currentCue: () => get().cues.find((cue) => cue.id === get().currentCueId) ?? null,
      selectedCue: () => get().cues.find((cue) => cue.id === get().selectedCueId) ?? null,
      previewCue: () => get().cues.find((cue) => cue.id === get().previewCueId) ?? null,
      nextCue: () => {
        const { cues, currentCueId } = get()
        const currentIndex = cues.findIndex((cue) => cue.id === currentCueId)
        if (currentIndex < 0) return cues[0] ?? null
        return cues[currentIndex + 1] ?? null
      },

      addCue: (input) => {
        const cue = makeCue(input)
        set((state) => ({
          cues: [...state.cues, cue],
          currentCueId: state.currentCueId ?? cue.id,
          selectedCueId: cue.id,
          previewCueId: state.previewCueId
        }))
        return cue.id
      },

      updateCue: (id, patch) => {
        const now = Date.now()
        set((state) => ({
          cues: state.cues.map((cue) =>
            cue.id === id
              ? {
                  ...cue,
                  ...patch,
                  updatedAt: now
                }
              : cue
          )
        }))
      },

      removeCue: (id) => {
        set((state) => removeCueId(state, id))
      },

      duplicateCue: (id) => {
        const source = get().cues.find((cue) => cue.id === id)
        if (!source) return null
        const now = Date.now()
        const duplicate = cloneCue(source, now)
        set((state) => {
          const index = state.cues.findIndex((cue) => cue.id === id)
          const cues = [...state.cues]
          cues.splice(index + 1, 0, duplicate)
          return {
            cues,
            selectedCueId: duplicate.id,
            previewCueId: state.previewCueId
          }
        })
        return duplicate.id
      },

      reorderCue: (fromIndex, toIndex) => {
        set((state) => {
          if (fromIndex === toIndex) return state
          if (fromIndex < 0 || fromIndex >= state.cues.length) return state
          const nextIndex = Math.max(0, Math.min(toIndex, state.cues.length - 1))
          const cues = [...state.cues]
          const [cue] = cues.splice(fromIndex, 1)
          cues.splice(nextIndex, 0, cue)
          return { cues }
        })
      },

      jumpToCue: (id) => {
        if (!get().cues.some((cue) => cue.id === id)) return
        set({ currentCueId: id, selectedCueId: id, previewCueId: id })
      },

      selectCue: (id) => {
        if (id !== null && !get().cues.some((cue) => cue.id === id)) return
        set({ selectedCueId: id })
      },

      previewCueById: (id) => {
        if (id !== null && !get().cues.some((cue) => cue.id === id)) return
        set({ previewCueId: id })
      },

      markComplete: (id, completed) => {
        const now = Date.now()
        set((state) => ({
          cues: state.cues.map((cue) =>
            cue.id === id
              ? {
                  ...cue,
                  completed: completed ?? !cue.completed,
                  updatedAt: now
                }
              : cue
          )
        }))
      },

      clear: () => {
        set(initialState)
      }
    }),
    {
      name: createPersistName('service-playlist'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        cues: state.cues,
        currentCueId: state.currentCueId,
        selectedCueId: state.selectedCueId,
        previewCueId: state.previewCueId
      })
    }
  )
)
