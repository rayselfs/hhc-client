import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@heroui/react/toast'
import { Button } from '@heroui/react/button'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Switch } from '@heroui/react/switch'
import { Label } from 'react-aria-components'
import { FolderSync } from 'lucide-react'
import {
  DEFAULT_ONEDRIVE,
  HHC_DEFAULT_ONEDRIVE_CLIENT_ID,
  useSettingsStore,
  validateOneDriveClientId,
  type OneDriveSettings
} from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'
import { connectLocalSyncFolder } from '@renderer/lib/local-sync-import'
import type { LocalSyncConnectionInfo } from '@shared/ipc-channels'
import type { SyncOfflinePolicy } from '@shared/types/folder'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const
const OFFLINE_POLICY_OPTIONS: SyncOfflinePolicy[] = ['online-only', 'on-demand', 'always-offline']

export type MediaSettingsSection = 'general' | 'oneDrive' | 'localSync'

interface MediaSettingsProps {
  section?: MediaSettingsSection
}

export default function MediaSettings({
  section = 'general'
}: MediaSettingsProps): React.JSX.Element {
  const { t } = useTranslation()
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays)
  const setTrashRetentionDays = useSettingsStore((s) => s.setTrashRetentionDays)
  const oneDrive = useSettingsStore((s) => s.oneDrive)
  const setOneDrive = useSettingsStore((s) => s.setOneDrive)
  const [oneDriveDraft, setOneDriveDraft] = useState<OneDriveSettings>(oneDrive)
  const [localSyncFolders, setLocalSyncFolders] = useState<LocalSyncConnectionInfo[]>([])
  const [localSyncBusy, setLocalSyncBusy] = useState(false)
  const [customClientIdEnabled, setCustomClientIdEnabled] = useState(
    oneDrive.customClientId.trim().length > 0
  )
  const customClientIdValid =
    oneDriveDraft.customClientId.trim().length === 0 ||
    validateOneDriveClientId(oneDriveDraft.customClientId)

  function saveOneDriveDraft(next: OneDriveSettings): void {
    setOneDriveDraft(next)
    setOneDrive(next)
  }

  useEffect(() => {
    if (section !== 'localSync' || !isElectron()) return
    let cancelled = false
    window.api.localSync
      .listFolders()
      .then((folders) => {
        if (!cancelled) setLocalSyncFolders(folders)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [section])

  async function handleConnectLocalSyncFolder(): Promise<void> {
    setLocalSyncBusy(true)
    try {
      const summary = await connectLocalSyncFolder()
      if (!summary) return
      setLocalSyncFolders(await window.api.localSync.listFolders())
      toast.success(
        t('preferences.media.localSync.connected', {
          name: summary.connection.displayName,
          count: summary.itemCount
        })
      )
    } catch (error) {
      console.warn('[local-sync] Failed to connect folder', error)
      toast.danger(t('preferences.media.localSync.connectFailed'))
    } finally {
      setLocalSyncBusy(false)
    }
  }

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
                placeholder={HHC_DEFAULT_ONEDRIVE_CLIENT_ID}
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

      {section === 'localSync' && (
        <section className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t('preferences.media.localSync.title')}</h3>
            <p className="text-xs text-muted">{t('preferences.media.localSync.description')}</p>
          </div>

          {isElectron() ? (
            <>
              <div className="flex items-start justify-between gap-4 border-t border-default-200 pt-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {t('preferences.media.localSync.localFolder')}
                  </p>
                  <p className="text-xs text-muted">
                    {t('preferences.media.localSync.localFolderDescription')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={localSyncBusy}
                  onPress={handleConnectLocalSyncFolder}
                >
                  <FolderSync className="size-4" />
                  {t('preferences.media.localSync.chooseFolder')}
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">
                  {t('preferences.media.localSync.connectedFolders')}
                </p>
                {localSyncFolders.length === 0 ? (
                  <p className="text-xs text-muted">{t('preferences.media.localSync.noFolders')}</p>
                ) : (
                  <ul className="space-y-2">
                    {localSyncFolders.map((folder) => (
                      <li
                        key={folder.id}
                        className="rounded-2xl bg-surface-secondary px-4 py-3 text-sm"
                      >
                        {folder.displayName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="rounded-2xl bg-surface-secondary px-4 py-3 text-sm text-muted">
              {t('preferences.media.localSync.desktopOnly')}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
