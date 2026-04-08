import { Outlet } from 'react-router-dom'
import Sidebar from '@renderer/components/Sidebar'
import Header from '@renderer/components/Header'
import { ProjectionProvider } from '@renderer/contexts/ProjectionContext'

export default function Layout(): React.JSX.Element {
  return (
    <ProjectionProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </ProjectionProvider>
  )
}
