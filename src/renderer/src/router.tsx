import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import Layout from '@renderer/components/Control/Layout'
import RouteError from '@renderer/components/RouteError'
import { isOnboarded } from '@renderer/lib/onboarding'
import WelcomePage from '@renderer/pages/WelcomePage'

const TimerPage = lazy(() => import('@renderer/pages/TimerPage'))
const BiblePage = lazy(() => import('@renderer/pages/BiblePage'))
const ServicePage = lazy(() => import('@renderer/pages/ServicePage'))
const SoundboardPage = lazy(() => import('@renderer/pages/SoundboardPage'))
const FilesPage = lazy(() => import('@renderer/pages/FilesPage'))
const FavoritesPage = lazy(() => import('@renderer/pages/FavoritesPage'))
const TrashPage = lazy(() => import('@renderer/pages/TrashPage'))

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
          <Suspense fallback={null}>
            <TimerPage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'bible',
        element: (
          <Suspense fallback={null}>
            <BiblePage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'service',
        element: (
          <Suspense fallback={null}>
            <ServicePage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'soundboard',
        element: (
          <Suspense fallback={null}>
            <SoundboardPage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'files',
        element: (
          <Suspense fallback={null}>
            <FilesPage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'favorites',
        element: (
          <Suspense fallback={null}>
            <FavoritesPage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      },
      {
        path: 'trash',
        element: (
          <Suspense fallback={null}>
            <TrashPage />
          </Suspense>
        ),
        ErrorBoundary: RouteError
      }
    ]
  },
  {
    path: '/welcome',
    element: <WelcomePage />
  }
]

export default routes

export const router = createHashRouter(routes)
