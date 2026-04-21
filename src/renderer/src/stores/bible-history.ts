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
      version: 2,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted, version) => {
        const state = persisted as { items: Record<string, unknown>[] }
        if (state.items) {
          state.items = state.items.map((item) => {
            const migrated = { ...item } as Record<string, unknown>

            if (version < 1) {
              const { folderId, ...rest } = migrated as Record<string, unknown> & {
                folderId?: string
              }
              Object.assign(migrated, rest)
              migrated.parentId = (migrated.parentId as string) ?? folderId ?? ''
              migrated.sortIndex = (migrated.sortIndex as number) ?? 0
              migrated.expiresAt = (migrated.expiresAt as number | null) ?? null
            }

            if (version < 2) {
              if ('verseStart' in migrated) {
                migrated.verse = migrated.verseStart
                delete migrated.verseStart
                delete migrated.verseEnd
              }
              if (!('versionId' in migrated)) {
                migrated.versionId = 0
              }
              delete migrated.bookCode
              delete migrated.bookName
              delete migrated.versionCode
              delete migrated.versionName
            }

            return migrated
          })
        }
        return persisted as BibleHistoryState
      }
    }
  )
)
