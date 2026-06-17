import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@heroui/react/switch'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Button } from '@heroui/react/button'
import { Label } from 'react-aria-components'
import { useTheme } from '@renderer/contexts/ThemeContext'
import { useSettingsStore } from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import type { DisplayInfo } from '@shared/ipc-channels'

function formatDisplayLabel(display: DisplayInfo): string {
  const name = display.label.trim()
  const size = `${display.bounds.width}×${display.bounds.height}`
  return name ? `${name} · ${size}` : size
}

export default function GeneralSettings(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { resolved, setPreference } = useTheme()
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration)
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration)
  const projectionDisplayId = useSettingsStore((s) => s.projectionDisplayId)
  const setProjectionDisplayId = useSettingsStore((s) => s.setProjectionDisplayId)
  const resetSettings = useSettingsStore((s) => s.resetSettings)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)
  const confirm = useConfirm()
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const externalDisplays = displays.filter((display) => !display.isPrimary)
  const selectedProjectionDisplayId = externalDisplays.length > 0 ? projectionDisplayId : ''

  useEffect(() => {
    if (!isElectron() || !window.api?.projection?.getDisplays) return
    window.api.projection
      .getDisplays()
      .then((nextDisplays) => {
        setDisplays(nextDisplays)
        const external = nextDisplays.filter((display) => !display.isPrimary)
        const selected = external.some((display) => String(display.id) === projectionDisplayId)
        const nextProjectionDisplayId = external[0] ? String(external[0].id) : ''
        if (!selected && projectionDisplayId !== nextProjectionDisplayId) {
          setProjectionDisplayId(nextProjectionDisplayId)
        }
      })
      .catch(() => setDisplays([]))
  }, [projectionDisplayId, setProjectionDisplayId])

  const languageOptions = [
    { value: 'en', label: t('preferences.languageNames.en') },
    { value: 'zh-TW', label: t('preferences.languageNames.zhTW') },
    { value: 'zh-CN', label: t('preferences.languageNames.zhCN') }
  ]

  const handleResetSettingsClick = async (): Promise<void> => {
    const confirmed = await confirm({
      status: 'warning',
      description: t('preferences.reset.settingsConfirm'),
      confirmLabel: t('preferences.reset.settingsButton'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    resetSettings()
  }

  const handleClearAllDataClick = async (): Promise<void> => {
    const confirmed = await confirm({
      status: 'danger',
      description: t('preferences.reset.allDataConfirm'),
      confirmLabel: t('preferences.reset.allDataButton'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    resetToDefaults()
  }

  return (
    <div className="p-5 space-y-6">
      <Select
        variant="secondary"
        value={i18n.language}
        onChange={(key) => i18n.changeLanguage(String(key))}
        aria-label={t('preferences.language')}
      >
        <Label>{t('preferences.language')}</Label>
        <Select.Trigger className="rounded-full pl-5">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {languageOptions.map((opt) => (
              <ListBox.Item
                key={opt.value}
                id={opt.value}
                textValue={opt.label}
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                {opt.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div>
        <label className="mb-2 block text-sm font-medium">{t('preferences.darkMode')}</label>
        <div>
          <Switch
            isSelected={resolved === 'dark'}
            onChange={(checked) => setPreference(checked ? 'dark' : 'light')}
            aria-label={t('preferences.darkMode')}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      </div>

      {isElectron() && (
        <>
          <Select
            variant="secondary"
            value={selectedProjectionDisplayId}
            onChange={(key) => setProjectionDisplayId(String(key))}
            aria-label={t('preferences.projectionDisplay.label')}
            isDisabled={externalDisplays.length === 0}
          >
            <Label>{t('preferences.projectionDisplay.label')}</Label>
            <Select.Trigger className="rounded-full pl-5">
              <Select.Value>
                {externalDisplays.length === 0
                  ? t('preferences.projectionDisplay.noExternalDisplay')
                  : undefined}
              </Select.Value>
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {externalDisplays.map((display) => {
                  const label = formatDisplayLabel(display)
                  return (
                    <ListBox.Item
                      key={display.id}
                      id={String(display.id)}
                      textValue={label}
                      className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                    >
                      {label}
                    </ListBox.Item>
                  )
                })}
              </ListBox>
            </Select.Popover>
          </Select>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {t('preferences.hardwareAcceleration')}
            </label>
            <div className="mb-2">
              <Switch
                isSelected={hardwareAcceleration}
                onChange={(checked) => setHardwareAcceleration(checked)}
                aria-label={t('preferences.hardwareAcceleration')}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
            <p className="text-xs text-gray-500">{t('preferences.hardwareAccelerationDesc')}</p>
          </div>
        </>
      )}

      <section className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">{t('preferences.reset.title')}</h3>
        <div className="space-y-2 rounded-2xl bg-default-100 p-4">
          <Button
            variant="danger"
            onPress={handleResetSettingsClick}
            className="rounded-full"
          >
            {t('preferences.reset.settingsButton')}
          </Button>
          <p className="text-xs text-gray-500">{t('preferences.reset.settingsDesc')}</p>
        </div>
        <div className="space-y-2 rounded-2xl bg-default-100 p-4">
          <Button
            variant="danger"
            onPress={handleClearAllDataClick}
            className="rounded-full"
          >
            {t('preferences.reset.allDataButton')}
          </Button>
          <p className="text-xs text-gray-500">{t('preferences.reset.allDataDesc')}</p>
        </div>
      </section>
    </div>
  )
}
