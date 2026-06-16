import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react/button'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Label } from 'react-aria-components'
import { useSettingsStore } from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'
import type { FfmpegConfigInfo } from '@shared/ipc-channels'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const

export default function MediaSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays)
  const setTrashRetentionDays = useSettingsStore((s) => s.setTrashRetentionDays)
  const [ffmpegConfig, setFfmpegConfig] = useState<FfmpegConfigInfo>({ status: 'not-configured' })
  const [isCheckingFfmpeg, setIsCheckingFfmpeg] = useState(false)
  const canConfigureFfmpeg = isElectron()

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
