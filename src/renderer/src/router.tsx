import { createHashRouter, Navigate } from 'react-router-dom'
import TimerPage from '@renderer/pages/TimerPage'
import BiblePage from '@renderer/pages/BiblePage'
import ProjectionPage from '@renderer/pages/ProjectionPage'
import Layout from '@renderer/components/Layout'

const routes = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <Navigate to="/timer" replace /> },
      { path: 'timer', Component: TimerPage },
      { path: 'bible', Component: BiblePage }
    ]
  },
  { path: '/projection', Component: ProjectionPage }
]

export default routes

export const router = createHashRouter(routes)
