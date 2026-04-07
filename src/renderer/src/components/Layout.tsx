import { Outlet } from 'react-router-dom'
import Sidebar from '@renderer/components/Sidebar'

export default function Layout(): React.JSX.Element {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="p-4" />
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
