import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/main.css'
import '@renderer/i18n'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { RouterProvider } from 'react-router-dom'
import { router } from '@renderer/router'
import { Toast } from '@heroui/react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ShortcutScopeProvider>
          <Toast.Provider placement="bottom" />
          <RouterProvider router={router} />
        </ShortcutScopeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)
