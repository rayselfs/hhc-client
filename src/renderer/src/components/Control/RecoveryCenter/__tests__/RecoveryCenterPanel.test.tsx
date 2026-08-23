import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import RecoveryCenterPanel from '@renderer/components/Control/RecoveryCenter/RecoveryCenterPanel'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import ConfirmDialog from '@renderer/components/Common/ConfirmDialog'

vi.mock('@renderer/lib/recovery-center', () => ({
  collectRecoveryIssues: vi.fn(async () => [
    {
      id: 'job-failed:job-1',
      kind: 'job-failed',
      severity: 'error',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      sourceId: 'job-1',
      occurredAt: 1,
      actions: [
        { type: 'retry-job', labelKey: 'recovery.actions.retryJob' },
        {
          type: 'cancel-job',
          labelKey: 'recovery.actions.cancelJob',
          destructive: true
        }
      ]
    }
  ]),
  runRecoveryAction: vi.fn(async () => undefined)
}))

import { collectRecoveryIssues, runRecoveryAction } from '@renderer/lib/recovery-center'

beforeEach(() => {
  vi.clearAllMocks()
  useRecoveryCenterStore.setState({ dismissedIssueIds: [], filter: 'all' })
})

function renderPanel(): ReturnType<typeof render> {
  return render(
    <ShortcutScopeProvider>
      <ConfirmDialogProvider>
        <RecoveryCenterPanel />
        <ConfirmDialog />
      </ConfirmDialogProvider>
    </ShortcutScopeProvider>
  )
}

it('shows issues and dismisses one active issue', async () => {
  const user = userEvent.setup()
  renderPanel()

  expect(await screen.findByText('Media job needs attention')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /dismiss/i }))

  expect(screen.queryByText('Media job needs attention')).not.toBeInTheDocument()
})

it('shows every implemented action and confirms destructive actions', async () => {
  const user = userEvent.setup()
  renderPanel()

  expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel job' }))

  expect(await screen.findByText('Cancel background job?')).toBeInTheDocument()
  expect(runRecoveryAction).not.toHaveBeenCalled()

  await user.click(screen.getAllByRole('button', { name: 'Cancel job' }).at(-1)!)

  expect(runRecoveryAction).toHaveBeenCalledWith('cancel-job', 'job-1')
})

it('does not expose a projection filter without a projection issue source', async () => {
  renderPanel()

  await screen.findByText('Media job needs attention')
  expect(screen.queryByRole('button', { name: 'Projection' })).not.toBeInTheDocument()
})

it('refreshes current issues on a semantic recovery-source change', async () => {
  renderPanel()
  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())

  await act(async () => {
    window.dispatchEvent(new Event('hhc:recovery-source-changed'))
  })

  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledTimes(2))
})

it('does not refresh for raw sync download progress events', async () => {
  renderPanel()
  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())

  for (let index = 0; index < 20; index++) {
    window.dispatchEvent(new Event('hhc:sync-entry-changed'))
  }
  await act(async () => undefined)

  expect(collectRecoveryIssues).toHaveBeenCalledOnce()
})

it('handles a terminal refresh failure without an unhandled rejection', async () => {
  vi.mocked(collectRecoveryIssues).mockRejectedValueOnce(new Error('scan failed'))

  renderPanel()

  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())
  expect(await screen.findByText('Recovery status unavailable')).toBeInTheDocument()
  expect(screen.queryByText('No current recovery issues')).not.toBeInTheDocument()
})

it('replaces stale rows with an error and clears it after a successful refresh', async () => {
  renderPanel()
  expect(await screen.findByText('Media job needs attention')).toBeInTheDocument()
  vi.mocked(collectRecoveryIssues).mockRejectedValueOnce(new Error('scan failed'))

  window.dispatchEvent(new Event('hhc:recovery-source-changed'))

  expect(await screen.findByText('Recovery status unavailable')).toBeInTheDocument()
  expect(screen.queryByText('Media job needs attention')).not.toBeInTheDocument()

  vi.mocked(collectRecoveryIssues).mockResolvedValueOnce([])
  window.dispatchEvent(new Event('hhc:recovery-source-changed'))

  expect(await screen.findByText('No current recovery issues')).toBeInTheDocument()
  expect(screen.queryByText('Recovery status unavailable')).not.toBeInTheDocument()
})

it('keeps the newest event refresh when the mount scan resolves later', async () => {
  let resolveMountScan:
    | ((issues: Awaited<ReturnType<typeof collectRecoveryIssues>>) => void)
    | undefined
  vi.mocked(collectRecoveryIssues)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMountScan = resolve
      })
    )
    .mockResolvedValueOnce([])
  renderPanel()
  await waitFor(() => expect(collectRecoveryIssues).toHaveBeenCalledOnce())

  await act(async () => {
    window.dispatchEvent(new Event('hhc:recovery-source-changed'))
  })
  expect(await screen.findByText('No current recovery issues')).toBeInTheDocument()

  await act(async () => {
    resolveMountScan?.([
      {
        id: 'job-failed:stale',
        kind: 'job-failed',
        severity: 'error',
        titleKey: 'recovery.issues.jobFailed.title',
        detailKey: 'recovery.issues.jobFailed.detail',
        occurredAt: 1,
        actions: []
      }
    ])
  })

  expect(screen.queryByText('Media job needs attention')).not.toBeInTheDocument()
})
