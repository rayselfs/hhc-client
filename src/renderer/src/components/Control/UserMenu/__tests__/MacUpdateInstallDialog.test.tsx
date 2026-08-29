import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import MacUpdateInstallDialog from '../MacUpdateInstallDialog'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

vi.mock('@heroui/react/modal', () => ({
  Modal: {
    Backdrop: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
      isOpen ? <div role="dialog">{children}</div> : null,
    Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Heading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  }
}))

const writeText = vi.fn(async () => undefined)

beforeEach(async () => {
  await i18n.changeLanguage('en')
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
})

describe('MacUpdateInstallDialog', () => {
  it('shows verified installation guidance and copies but never runs the fallback command', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ShortcutScopeProvider>
          <MacUpdateInstallDialog isOpen={true} onOpenChange={() => {}} />
        </ShortcutScopeProvider>
      </I18nextProvider>
    )

    expect(screen.getByRole('heading', { name: 'Install HHC Presenter' })).toBeInTheDocument()
    expect(
      screen.getByText('System Settings → Privacy & Security → Open Anyway')
    ).toBeInTheDocument()
    expect(
      screen.getByText('This command bypasses Gatekeeper for HHC Presenter.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('xattr -dr com.apple.quarantine "/Applications/HHC Presenter.app"')
    ).toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'xattr -dr com.apple.quarantine "/Applications/HHC Presenter.app"'
      )
    )
  })

  it('does not render while closed', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ShortcutScopeProvider>
          <MacUpdateInstallDialog isOpen={false} onOpenChange={() => {}} />
        </ShortcutScopeProvider>
      </I18nextProvider>
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
