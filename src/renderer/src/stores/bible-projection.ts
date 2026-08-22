import { create } from 'zustand'
import type { ContentMessageTuple } from '@renderer/contexts/ProjectionContext'
import type { ProjectionPayload } from '@shared/projection-messages'

interface BibleProjectionState {
  lastPayloads: ContentMessageTuple[] | null
  setLastPayloads: (payloads: ContentMessageTuple[]) => void
  updateSettingsPayload: (settings: ProjectionPayload<'bible:settings'>) => void
  clearLastPayloads: () => void
}

export const useBibleProjectionStore = create<BibleProjectionState>()((set, get) => ({
  lastPayloads: null,

  setLastPayloads: (payloads) => {
    set({ lastPayloads: payloads })
  },

  updateSettingsPayload: (settings) => {
    const payloads = get().lastPayloads
    if (!payloads) return

    const next = payloads.filter(([channel]) => channel !== 'bible:settings')
    set({ lastPayloads: [['bible:settings', settings], ...next] })
  },

  clearLastPayloads: () => {
    set({ lastPayloads: null })
  }
}))
