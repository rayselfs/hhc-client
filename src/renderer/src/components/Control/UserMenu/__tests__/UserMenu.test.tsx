import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { PresentationCloseDecisionProvider } from '@renderer/contexts/PresentationCloseDecisionContext'
import { PresentationSessionRegistryProvider } from '@renderer/contexts/PresentationSessionRegistryContext'
import ConfirmDialog from '../../../Common/ConfirmDialog'
import UserMenu from '../UserMenu'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import type { RecoveryIssue } from '@renderer/types/recovery-center'

const auth = vi.hoisted(() => ({
  value: {
    status: 'anonymous' as 'loading' | 'anonymous' | 'authenticated' | 'unavailable',
    session: null as { userId: string; displayName: string; roles: string[] } | null,
    signInStatus: 'idle' as 'idle' | 'pending' | 'cancelled' | 'expired',
    pendingSignInExpiresAt: null as number | null,
    signIn: vi.fn(async () => undefined),
    cancelSignIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => null)
  }
}))
const toastDanger = vi.hoisted(() => vi.fn())

vi.mock('@renderer/contexts/HhcAuthContext', () => ({
  useHhcAuth: () => auth.value
}))

vi.mock('@heroui/react/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react/toast')>()
  return { ...actual, toast: { ...actual.toast, danger: toastDanger } }
})

vi.mock('@renderer/lib/recovery-center', () => ({
  collectRecoveryIssues: vi.fn(async () => [])
}))

const recoveryIssue = {
  id: 'storage-integrity:orphan:blob-1',
  kind: 'storage-integrity' as const,
  severity: 'warning' as const,
  titleKey: 'recovery.issues.storageIntegrity.title',
  detailKey: 'recovery.issues.storageIntegrity.detail',
  occurredAt: 1,
  actions: []
} satisfies RecoveryIssue

function renderUserMenu(
  props: { isExpanded?: boolean; onOpenPreferences?: () => void } = {}
): ReturnType<typeof render> {
  const { isExpanded = true, ...userMenuProps } = props
  return render(
    <ShortcutScopeProvider>
      <I18nextProvider i18n={i18n}>
        <ConfirmDialogProvider>
          <PresentationSessionRegistryProvider>
            <PresentationCloseDecisionProvider>
              <UserMenu isExpanded={isExpanded} {...userMenuProps} />
              <ConfirmDialog />
            </PresentationCloseDecisionProvider>
          </PresentationSessionRegistryProvider>
        </ConfirmDialogProvider>
      </I18nextProvider>
    </ShortcutScopeProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  auth.value.status = 'anonymous'
  auth.value.session = null
  auth.value.signInStatus = 'idle'
  auth.value.pendingSignInExpiresAt = null
  auth.value.signIn = vi.fn(async () => undefined)
  auth.value.cancelSignIn = vi.fn(async () => undefined)
  auth.value.signOut = vi.fn(async () => undefined)
  auth.value.getAccessToken = vi.fn(async () => null)
  toastDanger.mockClear()
  vi.mocked(collectRecoveryIssues).mockResolvedValue([])
  useRecoveryCenterStore.setState({ dismissedIssueIds: [], filter: 'all' })
})

describe('UserMenu', () => {
  it('renders avatar with guest name', () => {
    const { container } = renderUserMenu()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Account menu for Guest' })).toHaveLength(1)
    expect(container.querySelector('button button')).not.toBeInTheDocument()
  })

  it('places the expanded recovery issue count after the account content in normal flow', async () => {
    vi.mocked(collectRecoveryIssues).mockResolvedValueOnce([recoveryIssue])

    renderUserMenu()

    const button = screen.getByRole('button', { name: 'Account menu for Guest' })
    const status = await screen.findByRole('status', { name: '1 recovery issues' })
    const layout = button.parentElement

    expect(status.closest('button')).toBeNull()
    expect(status.parentElement).toHaveClass('pointer-events-none')
    expect(status.parentElement).not.toHaveClass('absolute')
    expect(layout).toHaveClass('flex-row')
    expect(button).toHaveClass('flex-1')
    expect(button).not.toHaveClass('w-auto')
    expect(layout?.children[0]).toBe(button)
    expect(layout?.children[1]).toBe(status.parentElement)
  })

  it('stacks the collapsed recovery issue count below the account trigger in normal flow', async () => {
    vi.mocked(collectRecoveryIssues).mockResolvedValueOnce([recoveryIssue])

    renderUserMenu({ isExpanded: false })

    const button = screen.getByRole('button', { name: 'Account menu for Guest' })
    const status = await screen.findByRole('status', { name: '1 recovery issues' })
    const layout = button.parentElement

    expect(status.closest('button')).toBeNull()
    expect(status.parentElement).toHaveClass('pointer-events-none')
    expect(status.parentElement).not.toHaveClass('absolute')
    expect(layout).toHaveClass('flex-col')
    expect(button).toHaveClass('w-auto')
    expect(layout?.children[0]).toBe(button)
    expect(layout?.children[1]).toBe(status.parentElement)
  })

  it('exposes recovery unavailability outside the account menu button', async () => {
    vi.mocked(collectRecoveryIssues).mockRejectedValueOnce(new Error('scan failed'))

    renderUserMenu()

    const status = await screen.findByRole('status', { name: 'Recovery status unavailable' })
    expect(status.closest('button')).toBeNull()
    expect(status.parentElement).toHaveClass('pointer-events-none')
  })

  it('renders all menu items', () => {
    renderUserMenu()
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByText('Close App')).toBeInTheDocument()
  })

  it('hides update item in web mode', () => {
    renderUserMenu()
    expect(screen.queryByText('Up to Date')).not.toBeInTheDocument()
  })

  it('enables Login for an anonymous session', () => {
    renderUserMenu()
    const login = screen.getByText('Login').closest('[role="menuitem"]')
    expect(login).not.toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(login!)
    expect(auth.value.signIn).toHaveBeenCalledOnce()
  })

  it('shows Login when not logged in', () => {
    renderUserMenu()
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.queryByText('Logout')).not.toBeInTheDocument()
  })

  it('shows pending feedback and lets the user cancel sign-in', () => {
    auth.value.signInStatus = 'pending'
    auth.value.pendingSignInExpiresAt = Date.now() + 300_000
    renderUserMenu()

    expect(screen.getByText('Waiting for sign-in...')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel sign-in').closest('[role="menuitem"]')!)
    expect(auth.value.cancelSignIn).toHaveBeenCalledOnce()
    expect(screen.queryByText('Login')).not.toBeInTheDocument()
  })

  it.each([
    ['cancelled', 'Sign-in cancelled'],
    ['expired', 'Sign-in expired. Try again.']
  ] as const)('shows %s feedback with an immediate retry', (signInStatus, message) => {
    auth.value.signInStatus = signInStatus
    renderUserMenu()

    expect(screen.getByText(message)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Login').closest('[role="menuitem"]')!)
    expect(auth.value.signIn).toHaveBeenCalledOnce()
  })

  it.each([
    ['loading', 'Loading account...'],
    ['unavailable', 'Account unavailable']
  ] as const)('shows a disabled %s account state', (status, label) => {
    auth.value.status = status
    renderUserMenu()
    const item = screen.getByText(label).closest('[role="menuitem"]')
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByText('Login')).not.toBeInTheDocument()
  })

  it('shows the authenticated display name and logs out', () => {
    auth.value.status = 'authenticated'
    auth.value.session = { userId: 'user-1', displayName: 'Ada Lovelace', roles: [] }
    renderUserMenu()

    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Account menu for Ada Lovelace' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText('Logout').closest('[role="menuitem"]')!)
    expect(auth.value.signOut).toHaveBeenCalledOnce()
  })

  it.each([
    ['signIn', 'Login', 'Unable to sign in'],
    ['signOut', 'Logout', 'Unable to sign out']
  ] as const)('shows a toast when %s fails', async (method, action, message) => {
    if (method === 'signOut') {
      auth.value.status = 'authenticated'
      auth.value.session = { userId: 'user-1', displayName: 'Ada Lovelace', roles: [] }
    }
    auth.value[method] = vi.fn(async () => {
      throw new Error('failed')
    })
    renderUserMenu()

    fireEvent.click(screen.getByText(action).closest('[role="menuitem"]')!)
    await waitFor(() => expect(toastDanger).toHaveBeenCalledWith(message))
  })

  it('close app shows confirm dialog before calling window.close', async () => {
    const closeSpy = vi.fn()
    vi.stubGlobal('close', closeSpy)
    renderUserMenu()
    const closeApp = screen.getByText('Close App').closest('[role="menuitem"]')!
    fireEvent.click(closeApp)
    expect(await screen.findByText('Close Application')).toBeInTheDocument()
    expect(closeSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('preferences calls onOpenPreferences', () => {
    const onOpenPreferences = vi.fn()
    renderUserMenu({ onOpenPreferences })
    const preferences = screen.getByText('Preferences').closest('[role="menuitem"]')!
    fireEvent.click(preferences)
    expect(onOpenPreferences).toHaveBeenCalledOnce()
  })
})
