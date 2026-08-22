import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HhcOAuthCallbackPage from '@renderer/pages/HhcOAuthCallbackPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HhcOAuthCallbackPage />
  </StrictMode>
)
