import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import AppSidebar from '../AppSidebar'

function renderWithProviders(initialEntries: string[] = ['/']): ReturnType<typeof render> {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        children: [
          {
            index: true,
            element: (
              <SidebarProvider>
                <AppSidebar />
              </SidebarProvider>
            )
          },
          {
            path: 'timer',
            element: (
              <SidebarProvider>
                <AppSidebar />
              </SidebarProvider>
            )
          },
          {
            path: 'bible',
            element: (
              <SidebarProvider>
                <AppSidebar />
              </SidebarProvider>
            )
          }
        ]
      }
    ],
    { initialEntries }
  )

  return render(<RouterProvider router={router} />)
}

describe('AppSidebar', () => {
  it('renders Timer and Bible menu items in English', async () => {
    await i18n.changeLanguage('en')
    renderWithProviders(['/'])
    expect(screen.getByText('TIMER')).toBeInTheDocument()
    expect(screen.getByText('BIBLE')).toBeInTheDocument()
  })

  it('renders Timer menu item with visible text', async () => {
    await i18n.changeLanguage('en')
    renderWithProviders(['/'])
    expect(screen.getByText('TIMER')).toBeInTheDocument()
  })

  it('renders Bible menu item with visible text', async () => {
    await i18n.changeLanguage('en')
    renderWithProviders(['/'])
    expect(screen.getByText('BIBLE')).toBeInTheDocument()
  })

  it('does not render a collapse/trigger button', async () => {
    await i18n.changeLanguage('en')
    renderWithProviders(['/'])
    expect(document.querySelector('[data-sidebar="trigger"]')).not.toBeInTheDocument()
  })

  it('renders Timer and Bible labels in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW')
    renderWithProviders(['/'])
    expect(screen.getByText('計時器')).toBeInTheDocument()
    expect(screen.getByText('聖經')).toBeInTheDocument()
    // reset to en to avoid bleeding into other tests
    await i18n.changeLanguage('en')
  })
})
