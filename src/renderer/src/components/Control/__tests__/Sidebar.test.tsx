import { render, screen, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import Sidebar from '../Sidebar'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

function renderWithRouter(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        children: [
          { index: true, element: <Sidebar /> },
          { path: 'timer', element: <Sidebar /> },
          { path: 'bible', element: <Sidebar /> }
        ]
      }
    ],
    { initialEntries }
  )
  return render(
    <ShortcutScopeProvider>
      <ThemeProvider>
        <ConfirmDialogProvider>
          <RouterProvider router={router} />
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
  })

  it('renders Timer and Bible labels in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    renderWithRouter(['/'])
    expect(screen.getByText('計時器')).toBeInTheDocument()
    expect(screen.getByText('聖經')).toBeInTheDocument()
    await i18n.changeLanguage('en')
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
