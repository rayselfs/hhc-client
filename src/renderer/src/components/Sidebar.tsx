import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import { Timer, BookOpen } from 'lucide-react'
import UserMenu from '@renderer/components/Control/UserMenu/UserMenu'
import PreferencesDialog from '@renderer/components/Control/UserMenu/PreferencesDialog'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export default function Sidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const [prefsOpen, setPrefsOpen] = useState(false)

  const items: NavItem[] = [
    { to: '/timer', icon: Timer, label: t('nav.timer') },
    { to: '/bible', icon: BookOpen, label: t('nav.bible') }
  ]

  const isActive = (item: NavItem): boolean => {
    return location.pathname === item.to
  }

  return (
    <nav
      className="flex flex-col rounded-tr-3xl rounded-br-3xl bg-sidebar text-sidebar-foreground py-2 px-1"
      style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-min-width)' }}
    >
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.icon

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex cursor-default items-center gap-3 rounded-full px-3 py-2 ${active ? 'bg-accent-soft text-accent-soft-foreground' : ''}`}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto">
        <UserMenu onOpenPreferences={() => setPrefsOpen(true)} />
      </div>
      {prefsOpen && <PreferencesDialog isOpen={prefsOpen} onOpenChange={setPrefsOpen} />}
    </nav>
  )
}
