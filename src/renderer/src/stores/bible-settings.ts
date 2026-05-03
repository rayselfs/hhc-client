import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

export interface BibleSettingsStore {
  fontSize: number
  selectedVersionId: number
  speechMaxSessionMin: number
  setFontSize: (size: number) => void
  setSelectedVersionId: (id: number) => void
  setSpeechMaxSessionMin: (min: number) => void
}

export const useBibleSettingsStore = create<BibleSettingsStore>()(
  persist(
    (set) => ({
      fontSize: 90,
      selectedVersionId: 0,
      speechMaxSessionMin: 60,

      setFontSize: (size: number) => {
        set({ fontSize: size })
      },

      setSelectedVersionId: (id: number) => {
        set({ selectedVersionId: id })
      },

      setSpeechMaxSessionMin: (min: number) => {
        set({ speechMaxSessionMin: min })
      }
    }),
    {
      name: createKey('bible-settings'),
      storage: hhcPersistStorage,
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 1) {
          state.speechMaxSessionMin = 60
        }
        return state as unknown as BibleSettingsStore
      },
      partialize: (state) => ({
        fontSize: state.fontSize,
        selectedVersionId: state.selectedVersionId,
        speechMaxSessionMin: state.speechMaxSessionMin
      })
    }
  )
)
