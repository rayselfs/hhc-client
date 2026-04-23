import { create } from 'zustand'
import type { UpdateStatus } from '@shared/ipc-channels'

export interface UpdateState {
  status: UpdateStatus
  availableVersion: string | null
  error: string | null
}

export interface UpdateActions {
  check(): void
  setAvailable(version: string): void
  setNotAvailable(): void
  setDownloading(): void
  setDownloaded(): void
  setError(message: string): void
  reset(): void
}

export type UpdateStore = UpdateState & UpdateActions

export const useUpdateStore = create<UpdateStore>()((set) => ({
  status: 'idle',
  availableVersion: null,
  error: null,

  check: () => {
    set({ status: 'checking' })
  },

  setAvailable: (version: string) => {
    set({ status: 'available', availableVersion: version, error: null })
  },

  setNotAvailable: () => {
    set({ status: 'not-available', availableVersion: null, error: null })
  },

  setDownloading: () => {
    set({ status: 'downloading' })
  },

  setDownloaded: () => {
    set({ status: 'downloaded' })
  },

  setError: (message: string) => {
    set({ status: 'error', error: message })
  },

  reset: () => {
    set({ status: 'idle', availableVersion: null, error: null })
  }
}))
