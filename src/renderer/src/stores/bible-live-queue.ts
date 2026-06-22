import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'

export interface BibleQueueItem {
  id: string
  versionId: number
  bookNumber: number
  chapter: number
  verse: number
  text: string
  reference: string
  createdAt: number
}

interface AddBibleQueueItemInput {
  versionId: number
  bookNumber: number
  chapter: number
  verse: number
  text: string
  reference: string
}

interface BibleLiveQueueState {
  items: BibleQueueItem[]
  currentItemId: string | null
  addItem: (input: AddBibleQueueItemInput) => string
  removeItem: (id: string) => void
  clear: () => void
  setCurrentItem: (id: string | null) => void
  nextItem: () => BibleQueueItem | null
}

const initialState = {
  items: [] as BibleQueueItem[],
  currentItemId: null as string | null
}

function createQueueItem(input: AddBibleQueueItemInput): BibleQueueItem {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  }
}

export const useBibleLiveQueueStore = create<BibleLiveQueueState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addItem: (input) => {
        const item = createQueueItem(input)
        set((state) => ({
          items: [...state.items, item],
          currentItemId: state.currentItemId ?? item.id
        }))
        return item.id
      },

      removeItem: (id) => {
        set((state) => {
          const items = state.items.filter((item) => item.id !== id)
          const currentItemId =
            state.currentItemId === id ? (items[0]?.id ?? null) : state.currentItemId
          return { items, currentItemId }
        })
      },

      clear: () => {
        set(initialState)
      },

      setCurrentItem: (id) => {
        if (id !== null && !get().items.some((item) => item.id === id)) return
        set({ currentItemId: id })
      },

      nextItem: () => {
        const { items, currentItemId } = get()
        const currentIndex = items.findIndex((item) => item.id === currentItemId)
        if (currentIndex < 0) return items[0] ?? null
        return items[currentIndex + 1] ?? null
      }
    }),
    {
      name: createPersistName('bible-live-queue'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        items: state.items,
        currentItemId: state.currentItemId
      })
    }
  )
)
