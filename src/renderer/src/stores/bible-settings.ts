import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

export interface BibleSettingsStore {
  fontSize: number
  selectedVersionId: number
  speechMaxSessionSec: number
  setFontSize: (size: number) => void
  setSelectedVersionId: (id: number) => void
  setSpeechMaxSessionSec: (sec: number) => void
}

export const useBibleSettingsStore = create<BibleSettingsStore>()(
  persist(
    (set) => ({
      fontSize: 90,
      selectedVersionId: 0,
      speechMaxSessionSec: 3600,

      setFontSize: (size: number) => {
        set({ fontSize: size })
      },

      setSelectedVersionId: (id: number) => {
        set({ selectedVersionId: id })
      },

      setSpeechMaxSessionSec: (sec: number) => {
        set({ speechMaxSessionSec: sec })
      }
    }),
    {
      name: createKey('bible-settings'),
      storage: hhcPersistStorage,
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 1) {
          state.speechMaxSessionSec = 3600
        }
        if (version < 2) {
          const oldMin = (state.speechMaxSessionMin as number) ?? 60
          state.speechMaxSessionSec = oldMin * 60
          delete state.speechMaxSessionMin
        }
        return state as unknown as BibleSettingsStore
      },
      partialize: (state) => ({
        fontSize: state.fontSize,
        selectedVersionId: state.selectedVersionId,
        speechMaxSessionSec: state.speechMaxSessionSec
      })
    }
  )
)
