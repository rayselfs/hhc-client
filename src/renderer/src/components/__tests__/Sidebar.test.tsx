import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import Sidebar from '../Sidebar'

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
  return render(<RouterProvider router={router} />)
}

describe('Sidebar', () => {
  it('renders Timer and Bible menu items in English', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByText('TIMER')).toBeInTheDocument()
    expect(screen.getByText('BIBLE')).toBeInTheDocument()
  })

  it('renders Timer menu item with visible text', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByText('TIMER')).toBeInTheDocument()
  })

  it('renders Bible menu item with visible text', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByText('BIBLE')).toBeInTheDocument()
  })

  it('renders a nav element as the sidebar', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(['/'])
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders Timer and Bible labels in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    renderWithRouter(['/'])
    expect(screen.getByText('計時器')).toBeInTheDocument()
    expect(screen.getByText('聖經')).toBeInTheDocument()
    await i18n.changeLanguage('en')
  })
})
