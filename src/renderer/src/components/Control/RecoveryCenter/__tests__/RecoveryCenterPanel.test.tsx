import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import RecoveryCenterPanel from '@renderer/components/Control/RecoveryCenter/RecoveryCenterPanel'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'

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
      actions: [{ type: 'retry-job', labelKey: 'recovery.actions.retryJob' }]
    }
  ]),
  runRecoveryAction: vi.fn(async () => undefined)
}))

beforeEach(() => {
  useRecoveryCenterStore.setState({ dismissedIssueIds: [], filter: 'all' })
})

it('shows issues and dismisses one active issue', async () => {
  const user = userEvent.setup()
  render(<RecoveryCenterPanel />)

  expect(await screen.findByText('Media job needs attention')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /dismiss/i }))

  expect(screen.queryByText('Media job needs attention')).not.toBeInTheDocument()
})
