import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@heroui/react/toast'
import { Button } from '@heroui/react/button'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Switch } from '@heroui/react/switch'
import { Label } from 'react-aria-components'
import { ExternalLink } from 'lucide-react'
import {
  DEFAULT_ONEDRIVE,
  LIBREPRESENTER_DEFAULT_ONEDRIVE_CLIENT_ID,
  useSettingsStore,
  validateOneDriveClientId,
  type OneDriveSettings
} from '@renderer/stores/settings'
import type { SyncOfflinePolicy } from '@shared/types/folder'
import { listProviderConnectionsByType, type ProviderConnectionRecord } from '@renderer/lib/sync-db'
import { unlinkSyncConnectionFromApp } from '@renderer/lib/sync-unlink'
import { loginOneDriveAccount } from '@renderer/lib/onedrive-connect'
import { deleteWebOneDriveCredentials } from '@renderer/lib/onedrive-web-credentials'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { isElectron } from '@renderer/lib/env'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const
const OFFLINE_POLICY_OPTIONS: SyncOfflinePolicy[] = ['online-only', 'on-demand', 'always-offline']
const ONEDRIVE_CLIENT_ID_DOC_URL =
  'https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app'

export type MediaSettingsSection = 'general' | 'oneDrive'

interface MediaSettingsProps {
  section?: MediaSettingsSection
}

export default function MediaSettings({
  section = 'general'
}: MediaSettingsProps): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays)
  const setTrashRetentionDays = useSettingsStore((s) => s.setTrashRetentionDays)
  const oneDrive = useSettingsStore((s) => s.oneDrive)
  const setOneDrive = useSettingsStore((s) => s.setOneDrive)
  const defaultSyncOfflinePolicy = useSettingsStore((s) => s.defaultSyncOfflinePolicy)
  const setDefaultSyncOfflinePolicy = useSettingsStore((s) => s.setDefaultSyncOfflinePolicy)
  const [oneDriveDraft, setOneDriveDraft] = useState<OneDriveSettings>(oneDrive)
  const [customClientIdEnabled, setCustomClientIdEnabled] = useState(
    oneDrive.customClientId.trim().length > 0
  )
  const [oneDriveConnection, setOneDriveConnection] = useState<ProviderConnectionRecord | null>(
    null
  )
  const [oneDriveConnectionBusy, setOneDriveConnectionBusy] = useState(false)
  const customClientIdValid =
    oneDriveDraft.customClientId.trim().length === 0 ||
    validateOneDriveClientId(oneDriveDraft.customClientId)

  function saveOneDriveDraft(next: OneDriveSettings): void {
    setOneDriveDraft(next)
    setOneDrive(next)
  }

  const refreshOneDriveConnection = useCallback(async (): Promise<void> => {
    const connections = await listProviderConnectionsByType('onedrive')
    setOneDriveConnection(connections[0] ?? null)
  }, [])

  function notifyOneDriveConnectionChanged(): void {
    window.dispatchEvent(new Event('onedrive-connection-changed'))
  }

  async function handleLoginOneDrive(): Promise<void> {
    setOneDriveConnectionBusy(true)
    try {
      const connection = await loginOneDriveAccount()
      if (!connection) return
      await refreshOneDriveConnection()
      notifyOneDriveConnectionChanged()
      toast.success(t('preferences.media.oneDrive.connected'))
    } catch (error) {
      console.warn('[onedrive] Failed to connect account', error)
      const message =
        error instanceof Error && error.message === 'Only one OneDrive account can be connected'
          ? 'alreadyConnected'
          : error instanceof Error &&
              error.message === 'OneDrive connection is currently available in the desktop app only'
            ? 'desktopOnly'
            : 'connectFailed'
      toast.danger(
        message === 'connectFailed' && error instanceof Error
          ? error.message
          : t(`preferences.media.oneDrive.${message}`)
      )
    } finally {
      setOneDriveConnectionBusy(false)
    }
  }

  async function handleDisconnectOneDrive(): Promise<void> {
    if (!oneDriveConnection) return
    const confirmed = await confirm({
      title: t('preferences.media.oneDrive.disconnectTitle'),
      description: t('preferences.media.oneDrive.disconnectDescription'),
      status: 'danger'
    })
    if (!confirmed) return

    setOneDriveConnectionBusy(true)
    try {
      if (isElectron() && window.api?.oneDrive) {
        await window.api.oneDrive.deleteCredentials(oneDriveConnection.id)
      } else {
        await deleteWebOneDriveCredentials(oneDriveConnection.id)
      }
      await unlinkSyncConnectionFromApp(oneDriveConnection.id)
      await refreshOneDriveConnection()
      notifyOneDriveConnectionChanged()
      toast.success(t('preferences.media.oneDrive.disconnected'))
    } catch (error) {
      console.warn('[onedrive] Failed to disconnect account', error)
      toast.danger(t('preferences.media.oneDrive.disconnectFailed'))
    } finally {
      setOneDriveConnectionBusy(false)
    }
  }

  useEffect(() => {
    if (section !== 'oneDrive') return
    void refreshOneDriveConnection()
  }, [section, refreshOneDriveConnection])

  return (
    <div className="p-5 space-y-6">
      {section === 'general' && (
        <section className="space-y-4">
          <Select
            variant="secondary"
            value={trashRetentionDays}
            onChange={(key) => setTrashRetentionDays(Number(key))}
            aria-label={t('preferences.trash.retentionLabel')}
          >
            <Label>{t('preferences.trash.retentionLabel')}</Label>
            <Select.Trigger className="rounded-full pl-5">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {RETENTION_DAY_OPTIONS.map((days) => (
                  <ListBox.Item
                    key={days}
                    id={days}
                    textValue={t(`preferences.trash.days.${days}`)}
                    className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                  >
                    {t(`preferences.trash.days.${days}`)}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <p className="text-xs text-gray-500">{t('preferences.trash.retentionDesc')}</p>

          <div className="border-t border-default-200 pt-4">
            <Select
              variant="secondary"
              value={defaultSyncOfflinePolicy}
              onChange={(key) => setDefaultSyncOfflinePolicy(String(key) as SyncOfflinePolicy)}
              aria-label={t('preferences.media.defaultOfflinePolicy')}
            >
              <Label>{t('preferences.media.defaultOfflinePolicy')}</Label>
              <Select.Trigger className="rounded-full pl-5">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {OFFLINE_POLICY_OPTIONS.map((policy) => (
                    <ListBox.Item
                      key={policy}
                      id={policy}
                      textValue={t(`preferences.media.offlinePolicies.${policy}`)}
                      className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                    >
                      {t(`preferences.media.offlinePolicies.${policy}`)}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </section>
      )}

      {section === 'oneDrive' && (
        <section className="space-y-3">
          <div className="space-y-2 rounded-2xl bg-surface-secondary px-4 py-3">
            <p className="text-sm font-medium">
              {t('preferences.media.oneDrive.connectedAccount')}
            </p>
            {oneDriveConnection ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm">{oneDriveConnection.displayName}</p>
                  {oneDriveConnection.accountLabel && (
                    <p className="truncate text-xs text-muted">{oneDriveConnection.accountLabel}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  isDisabled={oneDriveConnectionBusy}
                  onPress={() => void handleDisconnectOneDrive()}
                >
                  {t('preferences.media.oneDrive.disconnect')}
                </Button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted">
                  {t('preferences.media.oneDrive.noConnectedAccount')}
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={oneDriveConnectionBusy}
                  onPress={() => void handleLoginOneDrive()}
                >
                  {oneDriveConnectionBusy
                    ? t('preferences.media.oneDrive.connecting')
                    : t('preferences.media.oneDrive.connect')}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">
              {t('preferences.media.oneDrive.customClientId')}
            </label>
            <Switch
              isSelected={customClientIdEnabled}
              onChange={(checked) => {
                setCustomClientIdEnabled(checked)
                if (!checked) {
                  saveOneDriveDraft({
                    ...oneDriveDraft,
                    customClientId: DEFAULT_ONEDRIVE.customClientId
                  })
                }
              }}
              aria-label={t('preferences.media.oneDrive.customClientId')}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          {customClientIdEnabled && (
            <div className="space-y-2">
              <input
                id="onedrive-client-id"
                value={oneDriveDraft.customClientId}
                onChange={(event) =>
                  setOneDriveDraft({ ...oneDriveDraft, customClientId: event.target.value })
                }
                onBlur={() => {
                  if (customClientIdValid) saveOneDriveDraft(oneDriveDraft)
                }}
                placeholder={LIBREPRESENTER_DEFAULT_ONEDRIVE_CLIENT_ID}
                className="w-full rounded-full border border-default-200 bg-transparent px-4 py-2 text-sm"
                aria-invalid={!customClientIdValid}
              />
              {!customClientIdValid && (
                <p className="text-xs text-danger-700">
                  {t('preferences.media.oneDrive.invalidClientId')}
                </p>
              )}
            </div>
          )}

          <a
            href={ONEDRIVE_CLIENT_ID_DOC_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t('preferences.media.oneDrive.clientIdHelp')}
            <ExternalLink size={12} />
          </a>
        </section>
      )}
    </div>
  )
}
