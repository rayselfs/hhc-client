import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { ProjectionThemeProvider } from '@renderer/contexts/ThemeContext'
import ProjectionPage from '@renderer/pages/ProjectionPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ProjectionThemeProvider>
        <ProjectionPage />
      </ProjectionThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)
