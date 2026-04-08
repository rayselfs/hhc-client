import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import { Timer, BookOpen, Sun, Moon } from 'lucide-react'
import { Switch } from '@heroui/react'
import { useTheme } from '@renderer/contexts/ThemeContext'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export default function Sidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const { resolved, setPreference } = useTheme()

  const isDark = resolved === 'dark'

  const items: NavItem[] = [
    { to: '/timer', icon: Timer, label: t('nav.timer') },
    { to: '/bible', icon: BookOpen, label: t('nav.bible') }
  ]

  const isActive = (item: NavItem): boolean => {
    return location.pathname === item.to
  }

  return (
    <nav
      className="flex flex-col gap-2 rounded-tr-3xl rounded-br-3xl bg-sidebar text-sidebar-foreground py-2 px-1"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.icon

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex cursor-default items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-accent-soft text-accent-soft-foreground' : ''}`}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto">
        <Switch
          isSelected={isDark}
          onChange={() => setPreference(isDark ? 'light' : 'dark')}
          size="sm"
        >
          {isDark ? <Moon className="size-3" /> : <Sun className="size-3" />}
        </Switch>
      </div>
    </nav>
  )
}
