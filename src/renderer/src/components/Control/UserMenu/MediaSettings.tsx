import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@heroui/react/toast'
import { Button } from '@heroui/react/button'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Switch } from '@heroui/react/switch'
import { Label } from 'react-aria-components'
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
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { isElectron } from '@renderer/lib/env'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const
const OFFLINE_POLICY_OPTIONS: SyncOfflinePolicy[] = ['online-only', 'on-demand', 'always-offline']

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
      }
      await unlinkSyncConnectionFromApp(oneDriveConnection.id)
      await refreshOneDriveConnection()
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
        <section className="space-y-3">
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
        </section>
      )}

      {section === 'oneDrive' && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('preferences.media.oneDrive.title')}</h3>

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
              <p className="text-xs text-muted">
                {t('preferences.media.oneDrive.noConnectedAccount')}
              </p>
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

          <div className="border-t border-default-200 pt-4">
            <Select
              variant="secondary"
              value={oneDriveDraft.defaultOfflinePolicy}
              onChange={(key) =>
                saveOneDriveDraft({
                  ...oneDriveDraft,
                  defaultOfflinePolicy: String(key) as SyncOfflinePolicy
                })
              }
              aria-label={t('preferences.media.oneDrive.defaultOfflinePolicy')}
            >
              <Label>{t('preferences.media.oneDrive.defaultOfflinePolicy')}</Label>
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
                      textValue={t(`preferences.media.oneDrive.offlinePolicies.${policy}`)}
                      className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                    >
                      {t(`preferences.media.oneDrive.offlinePolicies.${policy}`)}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </section>
      )}
    </div>
  )
}
