import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PersonalCloudStatus } from '../PersonalCloudStatus'
import { usePersonalSyncStore } from '@renderer/stores/personal-sync'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key })
}))
vi.mock('@renderer/contexts/ConfirmDialogContext', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@renderer/contexts/PresentationSessionRegistryContext', () => ({
  usePresentationSessionRegistry: () => ({})
}))
afterEach(cleanup)

it('shows retry before a root exists without offering destructive conflict actions for network failure', () => {
  usePersonalSyncStore.setState({
    activeOwnerId: 'owner',
    accountStatus: 'authenticated',
    syncStatus: 'failed',
    itemStatuses: {}
  })
  render(<PersonalCloudStatus />)
  expect(screen.getByRole('status')).toHaveTextContent('personalCloud.failed')
  expect(screen.getByRole('button', { name: 'personalCloud.retry' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'personalCloud.keepCloud' })).toBeNull()
})
