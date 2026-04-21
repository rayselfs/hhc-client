import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import ConfirmDialog from '../../../Common/ConfirmDialog'
import UserMenu from '../UserMenu'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

function renderUserMenu(props: { onOpenPreferences?: () => void } = {}): ReturnType<typeof render> {
  return render(
    <ShortcutScopeProvider>
      <I18nextProvider i18n={i18n}>
        <ConfirmDialogProvider>
          <UserMenu {...props} />
          <ConfirmDialog />
        </ConfirmDialogProvider>
      </I18nextProvider>
    </ShortcutScopeProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('UserMenu', () => {
  it('renders avatar with guest name', () => {
    const { container } = renderUserMenu()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
  })

  it('renders all menu items', () => {
    renderUserMenu()
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
    expect(screen.getByText('Check for Updates')).toBeInTheDocument()
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Close App')).toBeInTheDocument()
  })

  it('disabled items have aria-disabled', () => {
    renderUserMenu()
    const checkForUpdates = screen.getByText('Check for Updates').closest('[role="menuitem"]')
    expect(checkForUpdates).toHaveAttribute('aria-disabled', 'true')
  })

  it('login is disabled', () => {
    renderUserMenu()
    const login = screen.getByText('Login').closest('[role="menuitem"]')
    expect(login).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows Login when not logged in', () => {
    renderUserMenu()
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.queryByText('Logout')).not.toBeInTheDocument()
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
