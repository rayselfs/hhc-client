import { Outlet } from 'react-router-dom'
import Sidebar from '@renderer/components/Sidebar'
import Header from '@renderer/components/Header'
import FloatingTimer from '@renderer/components/FloatingTimer'
import ProjectionInitDialog from '@renderer/components/ProjectionInitDialog'
import TimerProjectionBridge from '@renderer/components/TimerProjectionBridge'
import { ProjectionProvider } from '@renderer/contexts/ProjectionContext'
import { TimerEngineProvider } from '@renderer/contexts/TimerEngineContext'

export default function Layout(): React.JSX.Element {
  return (
    <TimerEngineProvider>
      <ProjectionProvider>
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
          <Sidebar />
          <div className="flex flex-1 flex-col min-h-0">
            <Header />
            <main className="flex-1 overflow-y-auto py-4 px-6">
              <Outlet />
            </main>
          </div>
          <FloatingTimer />
        </div>
        <ProjectionInitDialog />
        <TimerProjectionBridge />
      </ProjectionProvider>
    </TimerEngineProvider>
  )
}
