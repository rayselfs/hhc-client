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

const auth = vi.hoisted(() => ({
  value: {
    status: 'anonymous' as 'loading' | 'anonymous' | 'authenticated' | 'unavailable',
    session: null as { userId: string; displayName: string; roles: string[] } | null,
    signIn: vi.fn(async () => undefined),
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

function renderUserMenu(props: { onOpenPreferences?: () => void } = {}): ReturnType<typeof render> {
  return render(
    <ShortcutScopeProvider>
      <I18nextProvider i18n={i18n}>
        <ConfirmDialogProvider>
          <PresentationSessionRegistryProvider>
            <PresentationCloseDecisionProvider>
              <UserMenu {...props} />
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
  auth.value.signIn = vi.fn(async () => undefined)
  auth.value.signOut = vi.fn(async () => undefined)
  auth.value.getAccessToken = vi.fn(async () => null)
  toastDanger.mockClear()
})

describe('UserMenu', () => {
  it('renders avatar with guest name', () => {
    const { container } = renderUserMenu()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Account menu for Guest' })).toHaveLength(1)
    expect(container.querySelector('button button')).not.toBeInTheDocument()
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
