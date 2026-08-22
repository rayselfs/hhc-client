import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import RecoveryIndicator from '@renderer/components/Control/RecoveryCenter/RecoveryIndicator'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'
import { countFailedOrBlockedMediaJobs } from '@renderer/lib/media-work-db'
import i18n from '@renderer/i18n'

const mocks = vi.hoisted(() => ({
  mediaJobsListener: undefined as (() => void) | undefined
}))

vi.mock('@renderer/lib/recovery-center', () => ({
  collectRecoveryIssues: vi.fn()
}))

vi.mock('@renderer/lib/media-work-db', () => ({
  countFailedOrBlockedMediaJobs: vi.fn(async () => 1),
  subscribeMediaJobs: vi.fn((listener: () => void) => {
    mocks.mediaJobsListener = listener
    return vi.fn()
  })
}))

beforeEach(async () => {
  await i18n.changeLanguage('en')
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
  await waitFor(() => expect(countFailedOrBlockedMediaJobs).toHaveBeenCalledOnce())

  await act(async () => {
    mocks.mediaJobsListener?.()
  })

  await waitFor(() => expect(countFailedOrBlockedMediaJobs).toHaveBeenCalledTimes(2))
  expect(collectRecoveryIssues).toHaveBeenCalledOnce()
  expect(countFailedOrBlockedMediaJobs).toHaveBeenLastCalledWith(['dismissed'])
})

it('runs a full recovery scan on window focus', async () => {
  render(<RecoveryIndicator />)
  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())

  window.dispatchEvent(new Event('focus'))

  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledTimes(2))
  expect(countFailedOrBlockedMediaJobs).not.toHaveBeenCalled()
})

it.each(['hhc:sync-entry-changed', 'hhc:resource-cleanup-journal-changed'])(
  'runs a full recovery scan on %s',
  async (eventName) => {
    render(<RecoveryIndicator />)
    await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())

    window.dispatchEvent(new Event(eventName))

    await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledTimes(2))
    expect(countFailedOrBlockedMediaJobs).not.toHaveBeenCalled()
  }
)

it('localizes its accessible issue count', async () => {
  await i18n.changeLanguage('zh-TW')

  render(<RecoveryIndicator />)

  expect(await screen.findByLabelText('1 個修復問題')).toBeInTheDocument()
})

it('keeps a newer job count when the full scan was already in flight', async () => {
  let resolveScan: ((issues: Awaited<ReturnType<typeof collectRecoveryIssues>>) => void) | undefined
  vi.mocked(collectRecoveryIssues).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveScan = resolve
    })
  )
  vi.mocked(countFailedOrBlockedMediaJobs).mockResolvedValueOnce(2)
  render(<RecoveryIndicator />)

  await act(async () => {
    mocks.mediaJobsListener?.()
  })
  expect(await screen.findByLabelText('2 recovery issues')).toBeInTheDocument()

  await act(async () => {
    resolveScan?.([
      {
        id: 'job-failed:stale',
        kind: 'job-failed',
        severity: 'error',
        titleKey: 'recovery.issues.jobFailed.title',
        detailKey: 'recovery.issues.jobFailed.detail',
        occurredAt: 1,
        actions: []
      },
      {
        id: 'storage-integrity:orphan:blob-1',
        kind: 'storage-integrity',
        severity: 'warning',
        titleKey: 'recovery.issues.storageIntegrity.title',
        detailKey: 'recovery.issues.storageIntegrity.detail',
        occurredAt: 2,
        actions: []
      }
    ])
  })

  expect(await screen.findByLabelText('3 recovery issues')).toBeInTheDocument()
})
