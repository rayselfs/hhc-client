import { createHashRouter, Navigate } from 'react-router-dom'
import TimerPage from '@renderer/pages/TimerPage'
import BiblePage from '@renderer/pages/BiblePage'
import ProjectionPage from '@renderer/pages/ProjectionPage'
import Layout from '@renderer/components/Layout'
import RouteError from '@renderer/components/RouteError'

const routes = [
  {
    path: '/',
    Component: Layout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, element: <Navigate to="/timer" replace /> },
      { path: 'timer', Component: TimerPage, ErrorBoundary: RouteError },
      { path: 'bible', Component: BiblePage, ErrorBoundary: RouteError }
    ]
  },
  { path: '/projection', Component: ProjectionPage, ErrorBoundary: RouteError }
]

export default routes

export const router = createHashRouter(routes)
