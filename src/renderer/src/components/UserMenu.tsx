import { Avatar, Dropdown } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { LogIn, Settings, RefreshCw, Keyboard, Power, CircleUser } from 'lucide-react'

interface UserMenuProps {
  onOpenPreferences?: () => void
}

export default function UserMenu({ onOpenPreferences }: UserMenuProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Dropdown.Root>
      <Dropdown.Trigger>
        <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-default-100 transition-colors">
          <Avatar.Root className="size-7">
            <Avatar.Fallback>
              <CircleUser className="size-4" />
            </Avatar.Fallback>
          </Avatar.Root>
          <span className="text-sm">{t('userMenu.guest')}</span>
        </button>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'preferences') onOpenPreferences?.()
            if (key === 'closeApp') window.close()
          }}
        >
          <Dropdown.Item id="login">
            <LogIn className="size-4" />
            {t('userMenu.login')}
          </Dropdown.Item>
          <Dropdown.Section>
            <Dropdown.Item id="preferences">
              <Settings className="size-4" />
              {t('userMenu.preferences')}
            </Dropdown.Item>
            <Dropdown.Item id="checkForUpdates" isDisabled={true}>
              <RefreshCw className="size-4" />
              {t('userMenu.checkForUpdates')}
            </Dropdown.Item>
            <Dropdown.Item id="keyboardShortcuts" isDisabled={true}>
              <Keyboard className="size-4" />
              {t('userMenu.keyboardShortcuts')}
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="closeApp" className="text-danger">
              <Power className="size-4" />
              {t('userMenu.closeApp')}
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  )
}
