import { create } from 'zustand'

interface BibleSpeechState {
  elapsedSeconds: number
  incrementElapsedSeconds: () => void
  resetElapsedSeconds: () => void
}

export const useBibleSpeechStore = create<BibleSpeechState>()((set) => ({
  elapsedSeconds: 0,
  incrementElapsedSeconds: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
  resetElapsedSeconds: () => set({ elapsedSeconds: 0 })
}))
