import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import KeyboardShortcutsDialog from '@renderer/components/KeyboardShortcutsDialog'
import UserMenu from '@renderer/components/UserMenu'

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
        <UserMenu />
      </I18nextProvider>
    )

    const trigger = screen.getByRole('button', { name: /guest/i })
    trigger.click()

    const shortcutsItem = screen.getByRole('menuitem', { name: /keyboard shortcuts/i })
    expect(shortcutsItem).not.toHaveAttribute('disabled')
  })
})
