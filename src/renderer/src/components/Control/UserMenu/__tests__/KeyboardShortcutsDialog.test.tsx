import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import KeyboardShortcutsDialog from '@renderer/components/Control/UserMenu/KeyboardShortcutsDialog'
import UserMenu from '@renderer/components/Control/UserMenu/UserMenu'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { isMac, getMetaKeyLabel } from '@renderer/lib/env'
import { getRegistered } from '@renderer/lib/shortcut-registry'

vi.mock('@renderer/lib/shortcut-registry', () => ({
  getRegistered: vi.fn(() => [])
}))

vi.mock('@renderer/lib/env', () => ({
  isMac: vi.fn(() => false),
  getMetaKeyLabel: vi.fn(() => 'Ctrl')
}))

describe('KeyboardShortcutsDialog', () => {
  it('renders with isOpen=true and shows section titles', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsDialog isOpen={true} onOpenChange={() => {}} />
      </I18nextProvider>
    )

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Bible')).toBeInTheDocument()
    expect(screen.getByText('Timer')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('does not render when isOpen=false', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsDialog isOpen={false} onOpenChange={() => {}} />
      </I18nextProvider>
    )

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })
})

describe('UserMenu', () => {
  it('keyboard shortcuts item is not disabled', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ConfirmDialogProvider>
          <UserMenu />
        </ConfirmDialogProvider>
      </I18nextProvider>
    )

    const trigger = screen.getByText('Guest')
    trigger.click()

    const shortcutsItem = screen.getByRole('menuitem', { name: /keyboard shortcuts/i })
    expect(shortcutsItem).not.toHaveAttribute('aria-disabled')
  })
})

describe('KeyboardShortcutsDialog - dynamic registry', () => {
  beforeEach(() => {
    vi.mocked(getRegistered).mockReturnValue([])
    vi.mocked(isMac).mockReturnValue(false)
    vi.mocked(getMetaKeyLabel).mockReturnValue('Ctrl')
  })

  it('reads shortcuts from registry instead of static config', () => {
    vi.mocked(getRegistered).mockReturnValue([
      {
        id: 'BIBLE.CUSTOM',
        config: { code: 'KeyB' },
        description: 'Custom Bible Shortcut',
        sectionKey: 'BIBLE'
      }
    ])

    render(
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsDialog isOpen={true} onOpenChange={() => {}} />
      </I18nextProvider>
    )

    expect(screen.getByText('Custom Bible Shortcut')).toBeInTheDocument()
  })

  it('falls back to static SHORTCUTS config when registry is empty', () => {
    vi.mocked(getRegistered).mockReturnValue([])

    render(
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsDialog isOpen={true} onOpenChange={() => {}} />
      </I18nextProvider>
    )

    const spaceKeys = screen.getAllByText('Space')
    expect(spaceKeys.length).toBeGreaterThan(0)
  })

  it('displays correct platform override for EDIT.DELETE on Mac', () => {
    vi.mocked(isMac).mockReturnValue(true)
    vi.mocked(getMetaKeyLabel).mockReturnValue('⌘')

    render(
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsDialog isOpen={true} onOpenChange={() => {}} />
      </I18nextProvider>
    )

    expect(screen.getAllByText('⌫').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('⌘').length).toBeGreaterThan(0)
  })

  it('displays correct key for EDIT.DELETE on non-Mac', () => {
    vi.mocked(isMac).mockReturnValue(false)
    vi.mocked(getMetaKeyLabel).mockReturnValue('Ctrl')

    render(
      <I18nextProvider i18n={i18n}>
        <KeyboardShortcutsDialog isOpen={true} onOpenChange={() => {}} />
      </I18nextProvider>
    )

    expect(screen.queryAllByText('⌘')).toHaveLength(0)
  })
})
