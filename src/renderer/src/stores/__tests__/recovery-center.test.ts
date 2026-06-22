import { beforeEach, expect, it } from 'vitest'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'

beforeEach(() => {
  useRecoveryCenterStore.setState({ dismissedIssueIds: [], filter: 'all' })
})

it('dismisses current issues and lets resolved ids disappear from persisted state', () => {
  useRecoveryCenterStore.getState().dismissIssue('job:failed:job-1')
  useRecoveryCenterStore.getState().dismissIssue('storage:missing:file-1')

  expect(useRecoveryCenterStore.getState().dismissedIssueIds).toEqual([
    'job:failed:job-1',
    'storage:missing:file-1'
  ])

  useRecoveryCenterStore.getState().pruneDismissedIssues(['storage:missing:file-1'])

  expect(useRecoveryCenterStore.getState().dismissedIssueIds).toEqual(['storage:missing:file-1'])
})

it('persists only UI preferences and dismissals', () => {
  useRecoveryCenterStore.getState().setFilter('sync')
  useRecoveryCenterStore.getState().dismissIssue('sync:auth:conn-1')

  const persisted = useRecoveryCenterStore.persist
    .getOptions()
    .partialize?.(useRecoveryCenterStore.getState()) as Record<string, unknown>

  expect(persisted).toEqual({
    dismissedIssueIds: ['sync:auth:conn-1'],
    filter: 'sync'
  })
})
