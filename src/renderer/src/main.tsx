import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/main.css'
import '@renderer/i18n'
import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { RouterProvider } from 'react-router-dom'
import { router } from '@renderer/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>
)
