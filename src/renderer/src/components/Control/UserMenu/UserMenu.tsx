import { Avatar } from '@heroui/react/avatar'
import { Button } from '@heroui/react/button'
import { Dropdown } from '@heroui/react/dropdown'
import { toast } from '@heroui/react/toast'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LogIn,
  LogOut,
  Settings,
  RefreshCw,
  Keyboard,
  Power,
  CircleUser,
  Info,
  X
} from 'lucide-react'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import KeyboardShortcutsDialog from '@renderer/components/Control/UserMenu/KeyboardShortcutsDialog'
import AboutDialog from '@renderer/components/Control/UserMenu/AboutDialog'
import RecoveryIndicator from '@renderer/components/Control/RecoveryCenter/RecoveryIndicator'
import { usePresentationSafeAction } from '@renderer/components/Control/PresentationNavigationGuard'
import { useHhcAuth } from '@renderer/contexts/HhcAuthContext'
import { isElectron } from '@renderer/lib/env'
import { useUpdateStore } from '@renderer/stores/update'
import {
  selectIsUpdateAvailable,
  selectUpdateStatus,
  selectAvailableVersion
} from '@renderer/stores/selectors/update'

interface UserMenuProps {
  isExpanded: boolean
  onOpenPreferences?: () => void
}

const glassDividerClass = [
  'relative mt-1 pt-1',
  'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-px',
  'before:h-[2px]',
  'before:bg-[linear-gradient(90deg,transparent_0%,var(--separator)_20%,var(--separator)_80%,transparent_100%)]'
].join(' ')

export default function UserMenu({
  isExpanded,
  onOpenPreferences
}: UserMenuProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isShortcutsOpen, setShortcutsOpen] = useState(false)
  const [isAboutOpen, setAboutOpen] = useState(false)
  const confirm = useConfirm()
  const runPresentationSafeAction = usePresentationSafeAction()
  const updateStatus = useUpdateStore(selectUpdateStatus)
  const isUpdateAvailable = useUpdateStore(selectIsUpdateAvailable)
  const availableVersion = useUpdateStore(selectAvailableVersion)
  const downloadPercent = useUpdateStore((state) => state.downloadPercent)
  const { status, session, signInStatus, signIn, cancelSignIn, signOut } = useHhcAuth()
  const accountLabel =
    status === 'authenticated' && session ? session.displayName : t('userMenu.guest')

  const handleCloseApp = async (): Promise<void> => {
    const confirmed = await confirm({
      status: 'danger',
      title: t('userMenu.closeAppTitle'),
      description: t('userMenu.closeAppConfirm'),
      confirmLabel: t('common.close'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    await runPresentationSafeAction(() => window.close())
  }

  return (
    <>
      <Dropdown.Root>
        <div
          className={`flex w-full items-center ${isExpanded ? 'flex-row gap-2' : 'flex-col gap-1'}`}
        >
          <Button
            variant="ghost"
            aria-label={t('userMenu.accountMenu', { name: accountLabel })}
            className={`flex h-auto min-w-0 items-center justify-start gap-2 rounded-full p-0 text-muted hover:opacity-70 ${isExpanded ? 'flex-1' : 'w-auto'}`}
          >
            <Avatar.Root className="shrink-0">
              <Avatar.Fallback>
                <CircleUser />
              </Avatar.Fallback>
            </Avatar.Root>
            {isExpanded && <span>{accountLabel}</span>}
          </Button>
          <div className="pointer-events-none flex shrink-0 items-center">
            <RecoveryIndicator />
          </div>
        </div>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'login') {
                void signIn().catch(() => toast.danger(t('userMenu.signInFailed')))
              }
              if (key === 'cancelLogin') {
                void cancelSignIn().catch(() => toast.danger(t('userMenu.signInFailed')))
              }
              if (key === 'logout') {
                void signOut().catch(() => toast.danger(t('userMenu.signOutFailed')))
              }
              if (key === 'preferences') onOpenPreferences?.()
              if (key === 'closeApp') handleCloseApp()
              if (key === 'keyboardShortcuts') setShortcutsOpen(true)
              if (key === 'about') setAboutOpen(true)
              if (key === 'checkForUpdates' && isUpdateAvailable) {
                useUpdateStore.getState().setDownloading()
                window.api.update.downloadAndInstall().catch(console.error)
              }
            }}
          >
            {status === 'authenticated' && session ? (
              <>
                <Dropdown.Item key="accountIdentity" id="accountIdentity" isDisabled>
                  <CircleUser className="size-4" />
                  {session.displayName}
                </Dropdown.Item>
                <Dropdown.Item
                  key="logout"
                  id="logout"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  <LogOut className="size-4" />
                  {t('userMenu.logout')}
                </Dropdown.Item>
              </>
            ) : status === 'anonymous' ? (
              signInStatus === 'pending' ? (
                <>
                  <Dropdown.Item key="signInPending" id="signInPending" isDisabled>
                    <RefreshCw className="size-4 animate-spin" />
                    {t('userMenu.signInPending')}
                  </Dropdown.Item>
                  <Dropdown.Item
                    key="cancelLogin"
                    id="cancelLogin"
                    className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                  >
                    <X className="size-4" />
                    {t('userMenu.cancelSignIn')}
                  </Dropdown.Item>
                </>
              ) : (
                <>
                  {signInStatus !== 'idle' && (
                    <Dropdown.Item key="signInFeedback" id="signInFeedback" isDisabled>
                      <Info className="size-4" />
                      {t(
                        signInStatus === 'cancelled'
                          ? 'userMenu.signInCancelled'
                          : 'userMenu.signInExpired'
                      )}
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item
                    key="login"
                    id="login"
                    className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                  >
                    <LogIn className="size-4" />
                    {t('userMenu.login')}
                  </Dropdown.Item>
                </>
              )
            ) : (
              <Dropdown.Item key="accountStatus" id="accountStatus" isDisabled>
                <RefreshCw className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
                {status === 'loading'
                  ? t('userMenu.loadingAccount')
                  : t('userMenu.accountUnavailable')}
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
            {isElectron() && (
              <Dropdown.Item
                id="checkForUpdates"
                isDisabled={!isUpdateAvailable}
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                <RefreshCw className="size-4" />
                {updateStatus === 'available'
                  ? t('userMenu.updateAvailable', { version: availableVersion })
                  : updateStatus === 'checking'
                    ? t('userMenu.checking')
                    : updateStatus === 'downloading'
                      ? downloadPercent === null
                        ? t('userMenu.downloadingUpdate')
                        : t('userMenu.downloadingUpdateProgress', { percent: downloadPercent })
                      : t('userMenu.upToDate')}
              </Dropdown.Item>
            )}
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
