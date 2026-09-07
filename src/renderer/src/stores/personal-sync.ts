import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'

type PersonalAccountStatus = 'loading' | 'anonymous' | 'authenticated' | 'unavailable'
interface PersonalSyncState {
  lastOwnerId: string | null
  activeOwnerId: string | null
  accountStatus: PersonalAccountStatus
  syncStatus: 'idle' | 'pending' | 'syncing' | 'synced' | 'conflict' | 'auth-required' | 'failed'
  errorCode: string | null
  setAccount(status: PersonalAccountStatus, ownerId?: string): void
}

export const usePersonalSyncStore = create<PersonalSyncState>()(
  persist(
    (set) => ({
      lastOwnerId: null,
      activeOwnerId: null,
      accountStatus: 'loading',
      syncStatus: 'idle',
      errorCode: null,
      setAccount: (status, ownerId) =>
        set((state) => ({
          accountStatus: status,
          activeOwnerId:
            status === 'authenticated'
              ? (ownerId ?? null)
              : status === 'unavailable'
                ? state.lastOwnerId
                : null,
          lastOwnerId:
            status === 'authenticated'
              ? (ownerId ?? null)
              : status === 'anonymous'
                ? null
                : state.lastOwnerId,
          syncStatus: 'idle',
          errorCode: null
        }))
    }),
    {
      name: createPersistName('personal-sync'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({ lastOwnerId: state.lastOwnerId })
    }
  )
)

export function isPersonalRecordVisible(record: { personalOwnerId?: string }): boolean {
  return (
    !record.personalOwnerId ||
    record.personalOwnerId === usePersonalSyncStore.getState().activeOwnerId
  )
}
