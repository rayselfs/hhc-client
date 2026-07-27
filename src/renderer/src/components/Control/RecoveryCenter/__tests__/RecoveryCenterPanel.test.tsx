import { render, screen } from '@testing-library/react'
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

import { runRecoveryAction } from '@renderer/lib/recovery-center'

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
