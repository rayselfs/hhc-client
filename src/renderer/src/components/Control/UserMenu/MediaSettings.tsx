import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@heroui/react/toast'
import { Button } from '@heroui/react/button'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Switch } from '@heroui/react/switch'
import { Label } from 'react-aria-components'
import { useSettingsStore } from '@renderer/stores/settings'
import type { LanRemoteStatus } from '@shared/ipc-channels'
import type { SyncOfflinePolicy } from '@shared/types/folder'
import { listProviderConnectionsByType, type ProviderConnectionRecord } from '@renderer/lib/sync-db'
import { unlinkSyncConnectionFromApp } from '@renderer/lib/sync-unlink'
import { loginOneDriveAccount } from '@renderer/lib/onedrive-connect'
import { deleteWebOneDriveCredentials } from '@renderer/lib/onedrive-web-credentials'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { isElectron } from '@renderer/lib/env'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const
const OFFLINE_POLICY_OPTIONS: SyncOfflinePolicy[] = ['online-only', 'on-demand', 'always-offline']
export type MediaSettingsSection = 'general' | 'oneDrive' | 'lanRemote'

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
  const defaultSyncOfflinePolicy = useSettingsStore((s) => s.defaultSyncOfflinePolicy)
  const setDefaultSyncOfflinePolicy = useSettingsStore((s) => s.setDefaultSyncOfflinePolicy)
  const lanRemote = useSettingsStore((s) => s.lanRemote)
  const setLanRemote = useSettingsStore((s) => s.setLanRemote)
  const [oneDriveConnection, setOneDriveConnection] = useState<ProviderConnectionRecord | null>(
    null
  )
  const [oneDriveConnectionBusy, setOneDriveConnectionBusy] = useState(false)
  const [lanRemoteStatus, setLanRemoteStatus] = useState<LanRemoteStatus | null>(null)
  const [lanRemoteBusy, setLanRemoteBusy] = useState(false)
  const [lanRemotePairingUrl, setLanRemotePairingUrl] = useState('')

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

  useEffect(() => {
    if (section !== 'lanRemote' || !isElectron() || !window.api?.lanRemote) return
    void window.api.lanRemote.getStatus().then(setLanRemoteStatus)
  }, [section])

  async function handleLanRemoteEnabledChange(enabled: boolean): Promise<void> {
    if (!isElectron() || !window.api?.lanRemote) return
    if (enabled && lanRemote.selectedHost.trim() === '') {
      setLanRemote({ ...lanRemote, enabled: false })
      toast.danger(t('preferences.media.lanRemote.hostRequired'))
      return
    }

    setLanRemoteBusy(true)
    try {
      const status = enabled
        ? await window.api.lanRemote.start({ host: lanRemote.selectedHost, port: 0 })
        : await window.api.lanRemote.stop()
      setLanRemote({ ...lanRemote, enabled: status.enabled })
      setLanRemoteStatus(status)
    } catch (error) {
      console.warn('[lan-remote] Failed to update LAN remote state', error)
      setLanRemote({ ...lanRemote, enabled: false })
      toast.danger(t('preferences.media.lanRemote.updateFailed'))
    } finally {
      setLanRemoteBusy(false)
    }
  }

  async function handleCreateLanRemotePairing(): Promise<void> {
    if (!isElectron() || !window.api?.lanRemote) return
    setLanRemoteBusy(true)
    try {
      const pairing = await window.api.lanRemote.createPairing('Mobile device')
      setLanRemotePairingUrl(pairing.url)
    } catch {
      toast.danger(t('preferences.media.lanRemote.pairingFailed'))
    } finally {
      setLanRemoteBusy(false)
    }
  }

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
            <p className="mt-2 text-xs text-gray-500">
              {t('preferences.media.defaultOfflinePolicyDesc')}
            </p>
          </div>
        </section>
      )}

      {section === 'oneDrive' && (
        <section>
          <div className="space-y-2">
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
        </section>
      )}

      {section === 'lanRemote' && isElectron() && (
        <section className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t('preferences.media.lanRemote.enable')}
            </label>
            <Switch
              isSelected={lanRemote.enabled}
              isDisabled={lanRemoteBusy}
              onChange={(checked) => void handleLanRemoteEnabledChange(checked)}
              aria-label={t('preferences.media.lanRemote.enable')}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <label className="block text-sm font-medium">
            {t('preferences.media.lanRemote.privateInterface')}
            <input
              value={lanRemote.selectedHost}
              onChange={(event) =>
                setLanRemote({ ...lanRemote, selectedHost: event.currentTarget.value })
              }
              className="mt-2 w-full rounded-full border border-default-200 bg-transparent px-4 py-2 text-sm"
            />
          </label>

          <p className="text-xs text-gray-500">
            {lanRemoteStatus?.enabled
              ? t('preferences.media.lanRemote.running', {
                  host: lanRemoteStatus.host,
                  port: lanRemoteStatus.port
                })
              : t('preferences.media.lanRemote.disabled')}
          </p>

          <div className="space-y-2 border-t border-default-200 pt-4">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!lanRemoteStatus?.enabled || lanRemoteBusy}
              onPress={() => void handleCreateLanRemotePairing()}
            >
              {t('preferences.media.lanRemote.createPairing')}
            </Button>
            {lanRemotePairingUrl ? (
              <input
                readOnly
                value={lanRemotePairingUrl}
                className="w-full rounded-full border border-default-200 bg-transparent px-4 py-2 text-sm"
                aria-label={t('preferences.media.lanRemote.pairingUrl')}
              />
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
