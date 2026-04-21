import { createHashRouter, Navigate } from 'react-router-dom'
import TimerPage from '@renderer/pages/TimerPage'
import BiblePage from '@renderer/pages/BiblePage'
import ProjectionPage from '@renderer/pages/ProjectionPage'
import Layout from '@renderer/components/Control/Layout'
import RouteError from '@renderer/components/RouteError'
import WelcomePage from '@renderer/pages/WelcomePage'
import { isOnboarded } from '@renderer/lib/onboarding'

// eslint-disable-next-line react-refresh/only-export-components
function OnboardingGuard({ children }: { children: React.JSX.Element }): React.JSX.Element {
  if (!isOnboarded()) return <Navigate to="/welcome" replace />
  return children
}

const routes = [
  {
    path: '/',
    element: (
      <OnboardingGuard>
        <Layout />
      </OnboardingGuard>
    ),
    ErrorBoundary: RouteError,
    children: [
      { index: true, element: <Navigate to="/timer" replace /> },
      { path: 'timer', Component: TimerPage, ErrorBoundary: RouteError },
      { path: 'bible', Component: BiblePage, ErrorBoundary: RouteError }
    ]
  },
  { path: '/welcome', Component: WelcomePage },
  { path: '/projection', Component: ProjectionPage, ErrorBoundary: RouteError }
]

export default routes

export const router = createHashRouter(routes)
