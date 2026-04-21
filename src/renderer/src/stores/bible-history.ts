import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'
import type { VerseItem } from '@shared/types/folder'

interface BibleHistoryState {
  items: VerseItem[]
  addToHistory: (verse: VerseItem) => void
  removeFromHistory: (id: string) => void
  clearHistory: () => void
}

const MAX_HISTORY = 50

export const useBibleHistoryStore = create<BibleHistoryState>()(
  persist(
    (set) => ({
      items: [],
      addToHistory: (verse) =>
        set((state) => {
          const filtered = state.items.filter((item) => item.id !== verse.id)
          const updated = [verse, ...filtered]
          return { items: updated.slice(0, MAX_HISTORY) }
        }),
      removeFromHistory: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id)
        })),
      clearHistory: () => set({ items: [] })
    }),
    {
      name: createKey('bible-history'),
      storage: hhcPersistStorage,
      version: 1,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted, version) => {
        if (version === 0) {
          const state = persisted as { items: Record<string, unknown>[] }
          if (state.items) {
            state.items = state.items.map((item) => {
              const { folderId, ...rest } = item as Record<string, unknown> & {
                folderId?: string
              }
              return {
                ...rest,
                parentId: (rest as { parentId?: string }).parentId ?? folderId ?? '',
                sortIndex: (rest as { sortIndex?: number }).sortIndex ?? 0,
                expiresAt: (rest as { expiresAt?: number | null }).expiresAt ?? null
              }
            })
          }
        }
        return persisted as BibleHistoryState
      }
    }
  )
)
