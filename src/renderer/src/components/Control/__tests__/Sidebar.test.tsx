import { act, render, screen, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import Sidebar from '../Sidebar'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { PresentationCloseDecisionProvider } from '@renderer/contexts/PresentationCloseDecisionContext'
import { PresentationSessionRegistryProvider } from '@renderer/contexts/PresentationSessionRegistryContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

vi.mock('@renderer/contexts/HhcAuthContext', () => ({
  useHhcAuth: () => ({
    status: 'anonymous',
    session: null,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => null)
  })
}))

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        children: [
          { index: true, element: <Sidebar /> },
          { path: 'timer', element: <Sidebar /> },
          { path: 'bible', element: <Sidebar /> },
          { path: 'service', element: <Sidebar /> },
          { path: 'soundboard', element: <Sidebar /> }
        ]
      }
    ],
    { initialEntries }
  )
  return render(
    <ShortcutScopeProvider>
      <ThemeProvider>
        <ConfirmDialogProvider>
          <PresentationSessionRegistryProvider>
            <PresentationCloseDecisionProvider>
              <RouterProvider router={router} />
            </PresentationCloseDecisionProvider>
          </PresentationSessionRegistryProvider>
        </ConfirmDialogProvider>
      </ThemeProvider>
    </ShortcutScopeProvider>
  )
}

describe('Sidebar', () => {
  it('renders nav element with Timer and Bible links in English', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByText('TIMER')).toBeInTheDocument()
    expect(screen.getByText('BIBLE')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /service/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /slides/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /soundboard/i })).not.toBeInTheDocument()
  })

  it('renders Timer and Bible labels in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    renderWithRouter(['/'])
    expect(screen.getByText('計時器')).toBeInTheDocument()
    expect(screen.getByText('聖經')).toBeInTheDocument()
    expect(screen.queryByText('流程')).not.toBeInTheDocument()
    expect(screen.queryByText('投影片')).not.toBeInTheDocument()
    expect(screen.queryByText('音效板')).not.toBeInTheDocument()
    await act(() => i18n.changeLanguage('en'))
  })

  it('renders UserMenu with guest name', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('Preferences menu item opens PreferencesDialog', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    const preferencesItem = screen.getByText('Preferences').closest('[role="menuitem"]')!
    fireEvent.click(preferencesItem)
    expect(screen.getByTestId('category-general')).toBeInTheDocument()
  })
})
