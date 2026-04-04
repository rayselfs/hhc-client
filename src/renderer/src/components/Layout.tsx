import { Outlet } from 'react-router-dom'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import AppSidebar from '@renderer/components/AppSidebar'

export default function Layout(): React.JSX.Element {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="bg-background p-4" />
        <main className="flex-1 bg-background p-4">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
