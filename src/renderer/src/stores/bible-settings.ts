import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

export interface BibleSettingsStore {
  fontSize: number
  selectedVersionId: number
  setFontSize: (size: number) => void
  setSelectedVersionId: (id: number) => void
}

export const useBibleSettingsStore = create<BibleSettingsStore>()(
  persist(
    (set) => ({
      fontSize: 90,
      selectedVersionId: 0,

      setFontSize: (size: number) => {
        set({ fontSize: size })
      },

      setSelectedVersionId: (id: number) => {
        set({ selectedVersionId: id })
      }
    }),
    {
      name: createKey('bible-settings'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        fontSize: state.fontSize,
        selectedVersionId: state.selectedVersionId
      })
    }
  )
)
