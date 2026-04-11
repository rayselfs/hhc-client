import { createJSONStorage } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import { toast } from '@heroui/react'
import i18n from '@renderer/i18n'

export const STORAGE_PREFIX = 'hhc-' as const

const hhcStateStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name)
    } catch {
      console.warn(`[persist] Failed to read "${name}" from storage`)
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value)
    } catch {
      toast.warning(i18n.t('toast.storageSaveFailed'))
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name)
    } catch {
      //
    }
  }
}

export const hhcPersistStorage = createJSONStorage(() => hhcStateStorage) as PersistStorage<unknown>

export function createPersistName(storeName: string): string {
  return `${STORAGE_PREFIX}${storeName}`
}

export function createStorageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`
}
