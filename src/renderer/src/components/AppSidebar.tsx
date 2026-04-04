import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Timer, BookOpen } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@renderer/components/ui/sidebar'

export default function AppSidebar() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <Sidebar collapsible="none" className="border-r-0 rounded-tr-xl rounded-br-xl">
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/' || location.pathname === '/timer'}
            >
              <Link to="/timer">
                <Timer />
                <span>{t('nav.timer')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === '/bible'}>
              <Link to="/bible">
                <BookOpen />
                <span>{t('nav.bible')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
