import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react/button'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Label } from 'react-aria-components'
import {
  DEFAULT_ONEDRIVE,
  getEffectiveOneDriveClientId,
  HHC_DEFAULT_ONEDRIVE_CLIENT_ID,
  useSettingsStore,
  validateOneDriveClientId,
  type OneDriveSettings
} from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'
import type { FfmpegConfigInfo } from '@shared/ipc-channels'
import type { SyncOfflinePolicy } from '@shared/types/folder'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const
const OFFLINE_POLICY_OPTIONS: SyncOfflinePolicy[] = ['online-only', 'on-demand', 'always-offline']

export default function MediaSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays)
  const setTrashRetentionDays = useSettingsStore((s) => s.setTrashRetentionDays)
  const oneDrive = useSettingsStore((s) => s.oneDrive)
  const setOneDrive = useSettingsStore((s) => s.setOneDrive)
  const [ffmpegConfig, setFfmpegConfig] = useState<FfmpegConfigInfo>({ status: 'not-configured' })
  const [isCheckingFfmpeg, setIsCheckingFfmpeg] = useState(false)
  const [oneDriveDraft, setOneDriveDraft] = useState<OneDriveSettings>(oneDrive)
  const canConfigureFfmpeg = isElectron()
  const effectiveOneDriveClientId = getEffectiveOneDriveClientId(oneDriveDraft)
  const customClientIdValid =
    oneDriveDraft.customClientId.trim().length === 0 ||
    validateOneDriveClientId(oneDriveDraft.customClientId)

  useEffect(() => {
    if (!canConfigureFfmpeg) return
    let cancelled = false
    void window.api.videoTranscode.getFfmpegConfig().then((config) => {
      if (!cancelled) setFfmpegConfig(config)
    })
    return () => {
      cancelled = true
    }
  }, [canConfigureFfmpeg])

  async function runFfmpegAction(action: () => Promise<FfmpegConfigInfo | null>): Promise<void> {
    setIsCheckingFfmpeg(true)
    try {
      const result = await action()
      if (result) setFfmpegConfig(result)
    } finally {
      setIsCheckingFfmpeg(false)
    }
  }

  function saveOneDriveDraft(next: OneDriveSettings): void {
    setOneDriveDraft(next)
    setOneDrive(next)
  }

  return (
    <div className="space-y-6">
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

      <section className="space-y-3 rounded-2xl border border-default-200 p-4">
        <div>
          <h3 className="text-sm font-semibold">{t('preferences.media.oneDrive.title')}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {t('preferences.media.oneDrive.description')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            {t('preferences.media.oneDrive.clientId')}
          </label>
          <input
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
          <p className="text-xs text-gray-500">
            {oneDriveDraft.customClientId.trim()
              ? t('preferences.media.oneDrive.clientIdSourceCustom')
              : t('preferences.media.oneDrive.clientIdSourceDefault')}
            : {effectiveOneDriveClientId}
          </p>
          {!customClientIdValid && (
            <p className="text-xs text-danger-700">
              {t('preferences.media.oneDrive.invalidClientId')}
            </p>
          )}
          <Button
            variant="secondary"
            className="rounded-full"
            onPress={() =>
              saveOneDriveDraft({
                ...oneDriveDraft,
                customClientId: DEFAULT_ONEDRIVE.customClientId
              })
            }
          >
            {t('preferences.media.oneDrive.restoreDefaultClientId')}
          </Button>
        </div>

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

        <label className="block text-sm font-medium">
          {t('preferences.media.oneDrive.cacheBudget')}
          <input
            type="number"
            min={0}
            value={oneDriveDraft.cacheBudgetMb}
            onChange={(event) =>
              saveOneDriveDraft({
                ...oneDriveDraft,
                cacheBudgetMb: Number(event.target.value)
              })
            }
            className="mt-2 w-full rounded-full border border-default-200 bg-transparent px-4 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-gray-500">{t('preferences.media.oneDrive.setupHint')}</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-default-200 p-4">
        <div>
          <h3 className="text-sm font-semibold">{t('preferences.media.videoTranscoding.title')}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {t('preferences.media.videoTranscoding.description')}
          </p>
        </div>

        {!canConfigureFfmpeg ? (
          <p className="text-sm text-gray-500">
            {t('preferences.media.videoTranscoding.webUnsupported')}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-gray-500">{t('preferences.media.videoTranscoding.status')}</dt>
              <dd>{t(`preferences.media.videoTranscoding.statuses.${ffmpegConfig.status}`)}</dd>
              <dt className="text-gray-500">
                {t('preferences.media.videoTranscoding.executable')}
              </dt>
              <dd>
                {ffmpegConfig.executableName ?? t('preferences.media.videoTranscoding.notSelected')}
              </dd>
              <dt className="text-gray-500">{t('preferences.media.videoTranscoding.version')}</dt>
              <dd>{ffmpegConfig.version ?? '-'}</dd>
              <dt className="text-gray-500">
                {t('preferences.media.videoTranscoding.capabilities')}
              </dt>
              <dd>
                {ffmpegConfig.capabilities
                  ? t('preferences.media.videoTranscoding.capabilitySummary', {
                      h264: ffmpegConfig.capabilities.hasH264Encoder ? 'OK' : 'Missing',
                      aac: ffmpegConfig.capabilities.hasAacEncoder ? 'OK' : 'Missing',
                      mp4: ffmpegConfig.capabilities.hasMp4Muxer ? 'OK' : 'Missing'
                    })
                  : '-'}
              </dd>
            </dl>

            {ffmpegConfig.message && (
              <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700">
                {ffmpegConfig.message}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                className="rounded-full"
                isDisabled={isCheckingFfmpeg}
                onPress={() => void runFfmpegAction(() => window.api.videoTranscode.selectFfmpeg())}
              >
                {t('preferences.media.videoTranscoding.select')}
              </Button>
              <Button
                variant="secondary"
                className="rounded-full"
                isDisabled={isCheckingFfmpeg}
                onPress={() =>
                  void runFfmpegAction(() => window.api.videoTranscode.validateFfmpeg())
                }
              >
                {t('preferences.media.videoTranscoding.validate')}
              </Button>
              <Button
                variant="danger"
                className="rounded-full"
                isDisabled={isCheckingFfmpeg}
                onPress={() =>
                  void runFfmpegAction(() => window.api.videoTranscode.removeFfmpegConfig())
                }
              >
                {t('preferences.media.videoTranscoding.remove')}
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              {t('preferences.media.videoTranscoding.installGuide')}{' '}
              <a
                href="https://ffmpeg.org/download.html"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                {t('preferences.media.videoTranscoding.installLink')}
              </a>
            </p>
          </>
        )}
      </section>
    </div>
  )
}
