import { createHashRouter } from 'react-router-dom'
import TimerPage from '@renderer/pages/TimerPage'
import BiblePage from '@renderer/pages/BiblePage'

const routes = [
  {
    path: '/',
    children: [
      { index: true, Component: TimerPage },
      { path: 'timer', Component: TimerPage },
      { path: 'bible', Component: BiblePage }
    ]
  }
]

export default routes

export const router = createHashRouter(routes)
