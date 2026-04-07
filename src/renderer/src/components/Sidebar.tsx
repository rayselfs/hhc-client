import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import { Timer, BookOpen } from 'lucide-react'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export default function Sidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()

  const items: NavItem[] = [
    { to: '/timer', icon: Timer, label: t('nav.timer') },
    { to: '/bible', icon: BookOpen, label: t('nav.bible') }
  ]

  const isActive = (item: NavItem): boolean => {
    if (item.to === '/timer') {
      return location.pathname === '/' || location.pathname === '/timer'
    }
    return location.pathname === item.to
  }

  return (
    <nav
      className="flex flex-col gap-2 rounded-tr-xl rounded-br-xl bg-default p-4"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.icon

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-accent-soft text-accent-soft-foreground' : 'text-muted hover:bg-default-hover hover:text-default-foreground'}`}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
