import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'
import type { RecoveryFilter } from '@renderer/types/recovery-center'

interface RecoveryCenterStore {
  dismissedIssueIds: string[]
  filter: RecoveryFilter
  dismissIssue: (issueId: string) => void
  pruneDismissedIssues: (activeIssueIds: string[]) => void
  setFilter: (filter: RecoveryFilter) => void
}

export const useRecoveryCenterStore = create<RecoveryCenterStore>()(
  persist(
    (set) => ({
      dismissedIssueIds: [],
      filter: 'all',
      dismissIssue: (issueId) =>
        set((state) =>
          state.dismissedIssueIds.includes(issueId)
            ? state
            : { dismissedIssueIds: [...state.dismissedIssueIds, issueId] }
        ),
      pruneDismissedIssues: (activeIssueIds) => {
        const active = new Set(activeIssueIds)
        set((state) => ({
          dismissedIssueIds: state.dismissedIssueIds.filter((id) => active.has(id))
        }))
      },
      setFilter: (filter) => set({ filter })
    }),
    {
      name: createPersistName('recovery-center'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        dismissedIssueIds: state.dismissedIssueIds,
        filter: state.filter
      })
    }
  )
)
