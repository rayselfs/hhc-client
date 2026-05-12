import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import { Timer, BookOpen, ChevronDown, ChevronRight, Film, Star, Trash2, Files } from 'lucide-react'
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
  const [mediaOpen, setMediaOpen] = useState(true)

  const topItems: NavItem[] = [
    { to: '/timer', icon: Timer, label: t('nav.timer') },
    { to: '/bible', icon: BookOpen, label: t('nav.bible') }
  ]

  const isActive = (to: string): boolean => location.pathname === to

  return (
    <nav className="shrink-0 flex flex-col rounded-tr-3xl rounded-br-3xl bg-surface text-foreground py-2 px-2 w-[180px] max-lg:w-[54px]">
      <ul className="flex flex-col gap-1">
        {topItems.map((item) => {
          const active = isActive(item.to)
          const Icon = item.icon
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                draggable={false}
                className={`flex cursor-default items-center gap-3 rounded-full px-3 py-2 max-lg:justify-center max-lg:px-2 ${active ? 'bg-accent text-accent-foreground' : 'text-muted hover:opacity-70'}`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="max-lg:hidden">{item.label}</span>
              </Link>
            </li>
          )
        })}

        <li>
          <button
            type="button"
            onClick={() => setMediaOpen((prev) => !prev)}
            className={`flex w-full cursor-default items-center gap-3 rounded-full px-3 py-2 max-lg:justify-center max-lg:px-2 text-muted hover:opacity-70`}
          >
            <Film className="size-5 shrink-0" />
            <span className="max-lg:hidden flex-1 text-left">{t('nav.media')}</span>
            <span className="max-lg:hidden shrink-0">
              {mediaOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </span>
          </button>

          {mediaOpen && (
            <ul className="mt-0.5 flex flex-col gap-0.5 max-lg:hidden">
              <li>
                <Link
                  to="/files"
                  draggable={false}
                  className={`flex cursor-default items-center gap-3 rounded-full py-1.5 pl-7 pr-3 text-sm ${isActive('/files') ? 'bg-accent text-accent-foreground' : 'text-muted hover:opacity-70'}`}
                >
                  <Files className="size-4 shrink-0" />
                  <span>{t('nav.files')}</span>
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-default items-center gap-3 rounded-full py-1.5 pl-7 pr-3 text-sm text-muted opacity-40"
                >
                  <Star className="size-4 shrink-0" />
                  <span>{t('nav.favorites')}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-default items-center gap-3 rounded-full py-1.5 pl-7 pr-3 text-sm text-muted opacity-40"
                >
                  <Trash2 className="size-4 shrink-0" />
                  <span>{t('nav.trash')}</span>
                </button>
              </li>
            </ul>
          )}
        </li>
      </ul>

      <div className="mt-auto">
        <UserMenu onOpenPreferences={() => setPrefsOpen(true)} />
      </div>
      {prefsOpen && <PreferencesDialog isOpen={prefsOpen} onOpenChange={setPrefsOpen} />}
    </nav>
  )
}
