import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import ProjectionPage from '@renderer/pages/ProjectionPage'
import Layout from '@renderer/components/Control/Layout'
import RouteError from '@renderer/components/RouteError'
import LoadingFallback from '@renderer/components/Control/LoadingFallback'
import { isOnboarded } from '@renderer/lib/onboarding'

const TimerPage = lazy(() => import('@renderer/pages/TimerPage'))
const BiblePage = lazy(() => import('@renderer/pages/BiblePage'))
const WelcomePage = lazy(() => import('@renderer/pages/WelcomePage'))

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
      {
        path: 'timer',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <TimerPage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'bible',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <BiblePage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      }
    ]
  },
  {
    path: '/welcome',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <WelcomePage />
      </Suspense>
    )
  },
  { path: '/projection', Component: ProjectionPage, ErrorBoundary: RouteError }
]

export default routes

export const router = createHashRouter(routes)
