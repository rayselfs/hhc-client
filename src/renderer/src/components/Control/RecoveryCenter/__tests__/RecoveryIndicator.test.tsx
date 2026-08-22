import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import RecoveryIndicator from '@renderer/components/Control/RecoveryCenter/RecoveryIndicator'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'

const mocks = vi.hoisted(() => ({
  mediaJobsListener: undefined as (() => void) | undefined
}))

vi.mock('@renderer/lib/recovery-center', () => ({
  collectRecoveryIssues: vi.fn()
}))

vi.mock('@renderer/lib/media-work-db', () => ({
  subscribeMediaJobs: vi.fn((listener: () => void) => {
    mocks.mediaJobsListener = listener
    return vi.fn()
  })
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mediaJobsListener = undefined
  useRecoveryCenterStore.setState({
    dismissedIssueIds: ['job-failed:dismissed'],
    filter: 'all'
  })
  vi.mocked(collectRecoveryIssues).mockResolvedValue([
    {
      id: 'job-failed:dismissed',
      kind: 'job-failed',
      severity: 'error',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      occurredAt: 1,
      actions: []
    },
    {
      id: 'job-failed:visible',
      kind: 'job-failed',
      severity: 'warning',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      occurredAt: 2,
      actions: []
    }
  ])
})

it('counts only active non-dismissed issues', async () => {
  render(<RecoveryIndicator />)

  expect(await screen.findByLabelText('1 recovery issues')).toBeInTheDocument()
})

it('refreshes when media jobs change', async () => {
  render(<RecoveryIndicator />)
  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())

  await act(async () => {
    mocks.mediaJobsListener?.()
  })

  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledTimes(2))
})
