import { useTranslation } from 'react-i18next'
import { Timer, BookOpen } from 'lucide-react'
import AppSidebarNav from '@renderer/components/ui/AppSidebarNav'

export default function AppSidebar(): React.JSX.Element {
  const { t } = useTranslation()

  const items = [
    { to: '/timer', icon: Timer, label: t('nav.timer') },
    { to: '/bible', icon: BookOpen, label: t('nav.bible') }
  ]

  return <AppSidebarNav items={items} className="rounded-tr-xl rounded-br-xl" />
}
