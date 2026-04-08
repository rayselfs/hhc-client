import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/main.css'
import '@renderer/i18n'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { RouterProvider } from 'react-router-dom'
import { router } from '@renderer/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)
