import { Avatar } from '@heroui/react/avatar'
import { Dropdown } from '@heroui/react/dropdown'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, Settings, RefreshCw, Keyboard, Power, CircleUser, Info } from 'lucide-react'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import KeyboardShortcutsDialog from '@renderer/components/Control/UserMenu/KeyboardShortcutsDialog'
import AboutDialog from '@renderer/components/Control/UserMenu/AboutDialog'

interface UserMenuProps {
  onOpenPreferences?: () => void
}

const glassDividerClass = [
  'relative mt-1 pt-1',
  'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-px',
  'before:h-[2px]',
  'before:bg-[linear-gradient(90deg,transparent_0%,var(--separator)_20%,var(--separator)_80%,transparent_100%)]'
].join(' ')

export default function UserMenu({ onOpenPreferences }: UserMenuProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isShortcutsOpen, setShortcutsOpen] = useState(false)
  const [isAboutOpen, setAboutOpen] = useState(false)
  const confirm = useConfirm()

  const handleCloseApp = async (): Promise<void> => {
    const confirmed = await confirm({
      status: 'danger',
      title: t('userMenu.closeAppTitle'),
      description: t('userMenu.closeAppConfirm'),
      confirmLabel: t('common.close'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    window.close()
  }

  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger>
          <div className="flex items-center gap-2 w-full max-lg:justify-center rounded-lg hover:bg-default-100 transition-colors cursor-pointer">
            <Avatar.Root className="shrink-0">
              <Avatar.Fallback>
                <CircleUser />
              </Avatar.Fallback>
            </Avatar.Root>
            <span className="max-lg:hidden">{t('userMenu.guest')}</span>
          </div>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'login') setIsLoggedIn(true)
              if (key === 'logout') setIsLoggedIn(false)
              if (key === 'preferences') onOpenPreferences?.()
              if (key === 'closeApp') handleCloseApp()
              if (key === 'keyboardShortcuts') setShortcutsOpen(true)
              if (key === 'about') setAboutOpen(true)
            }}
          >
            {isLoggedIn ? (
              <Dropdown.Item
                id="logout"
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                <LogOut className="size-4" />
                {t('userMenu.logout')}
              </Dropdown.Item>
            ) : (
              <Dropdown.Item id="login" isDisabled>
                <LogIn className="size-4" />
                {t('userMenu.login')}
              </Dropdown.Item>
            )}
            <Dropdown.Item
              id="preferences"
              className={`data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground ${glassDividerClass}`}
            >
              <Settings className="size-4" />
              {t('userMenu.preferences')}
            </Dropdown.Item>
            <Dropdown.Item
              id="keyboardShortcuts"
              className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
            >
              <Keyboard className="size-4" />
              {t('userMenu.keyboardShortcuts')}
            </Dropdown.Item>
            <Dropdown.Item
              id="about"
              className={`data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground ${glassDividerClass}`}
            >
              <Info className="size-4" />
              {t('about.title')}
            </Dropdown.Item>
            <Dropdown.Item id="checkForUpdates" isDisabled={true}>
              <RefreshCw className="size-4" />
              {t('userMenu.checkForUpdates')}
            </Dropdown.Item>
            <Dropdown.Item
              id="closeApp"
              className={`text-danger data-[hovered=true]:bg-accent ${glassDividerClass}`}
            >
              <Power className="size-4" />
              {t('userMenu.closeApp')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {isShortcutsOpen && (
        <KeyboardShortcutsDialog isOpen={isShortcutsOpen} onOpenChange={setShortcutsOpen} />
      )}
      {isAboutOpen && <AboutDialog isOpen={isAboutOpen} onOpenChange={setAboutOpen} />}
    </>
  )
}
