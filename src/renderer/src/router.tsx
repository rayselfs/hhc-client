import { createHashRouter, Navigate } from 'react-router-dom'
import TimerPage from '@renderer/pages/TimerPage'
import BiblePage from '@renderer/pages/BiblePage'
import ProjectionPage from '@renderer/pages/ProjectionPage'
import Layout from '@renderer/components/Layout'
import RouteError from '@renderer/components/RouteError'
import { isOnboarded } from '@renderer/lib/onboarding'
import WelcomePage from '@renderer/pages/WelcomePage'

function RootRedirect(): React.JSX.Element {
  return <Navigate to={isOnboarded() ? '/timer' : '/welcome'} replace />
}

const routes = [
  {
    path: '/',
    Component: Layout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: 'timer', Component: TimerPage, ErrorBoundary: RouteError },
      { path: 'bible', Component: BiblePage, ErrorBoundary: RouteError }
    ]
  },
  { path: '/welcome', Component: WelcomePage },
  { path: '/projection', Component: ProjectionPage, ErrorBoundary: RouteError }
]

export default routes

export const router = createHashRouter(routes)
