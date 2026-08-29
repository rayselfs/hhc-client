import { create } from 'zustand'
import type { UpdateStatus } from '@shared/ipc-channels'

export interface UpdateState {
  status: UpdateStatus
  availableVersion: string | null
  error: string | null
  downloadPercent: number | null
}

export interface UpdateActions {
  check(): void
  setAvailable(version: string): void
  setNotAvailable(): void
  setDownloading(percent?: number): void
  setVerifying(): void
  setDownloaded(): void
  setInstallerOpened(): void
  setError(message: string): void
  reset(): void
}

export type UpdateStore = UpdateState & UpdateActions

export const useUpdateStore = create<UpdateStore>()((set) => ({
  status: 'idle',
  availableVersion: null,
  error: null,
  downloadPercent: null,

  check: () => {
    set({ status: 'checking', downloadPercent: null })
  },

  setAvailable: (version: string) => {
    set({ status: 'available', availableVersion: version, error: null, downloadPercent: null })
  },

  setNotAvailable: () => {
    set({ status: 'not-available', availableVersion: null, error: null, downloadPercent: null })
  },

  setDownloading: (percent) => {
    set({ status: 'downloading', downloadPercent: percent ?? null })
  },

  setVerifying: () => {
    set({ status: 'verifying', downloadPercent: null })
  },

  setDownloaded: () => {
    set({ status: 'downloaded', downloadPercent: null })
  },

  setInstallerOpened: () => {
    set({ status: 'installer-opened', downloadPercent: null })
  },

  setError: (message: string) => {
    set({ status: 'error', error: message, downloadPercent: null })
  },

  reset: () => {
    set({ status: 'idle', availableVersion: null, error: null, downloadPercent: null })
  }
}))
