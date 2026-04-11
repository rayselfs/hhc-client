import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Switch, Select, ListBox, Button } from '@heroui/react'
import { Label } from 'react-aria-components'
import { useTheme } from '@renderer/contexts/ThemeContext'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'

const TIMEZONE_LABEL_KEYS = {
  'timezones.taipei': 'timezones.taipei',
  'timezones.tokyo': 'timezones.tokyo',
  'timezones.newYork': 'timezones.newYork',
  'timezones.losAngeles': 'timezones.losAngeles',
  'timezones.malaysia': 'timezones.malaysia',
  'timezones.athens': 'timezones.athens',
  'timezones.melbourne': 'timezones.melbourne',
  'timezones.london': 'timezones.london'
} as const

type TimezoneKey = keyof typeof TIMEZONE_LABEL_KEYS

interface GeneralSettingsProps {
  onClose: () => void
}

export default function GeneralSettings({ onClose }: GeneralSettingsProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { resolved, setPreference } = useTheme()
  const timezone = useSettingsStore((s) => s.timezone)
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration)
  const setTimezone = useSettingsStore((s) => s.setTimezone)
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)
  const confirm = useConfirm()

  const languageOptions = [
    { value: 'en', label: t('preferences.languageNames.en') },
    { value: 'zh-TW', label: t('preferences.languageNames.zhTW') },
    { value: 'zh-CN', label: t('preferences.languageNames.zhCN') }
  ]

  const handleResetClick = async (): Promise<void> => {
    const confirmed = await confirm({
      status: 'warning',
      description: t('preferences.resetToDefaultsConfirm'),
      confirmLabel: t('preferences.resetBtn'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    resetToDefaults()
    setPreference('system')
    i18n.changeLanguage('en')
    onClose()
    navigate('/welcome')
  }

  return (
    <div className="space-y-6">
      <Select
        variant="secondary"
        value={i18n.language}
        onChange={(key) => i18n.changeLanguage(String(key))}
        aria-label={t('preferences.language')}
      >
        <Label>{t('preferences.language')}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {languageOptions.map((opt) => (
              <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                {opt.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        variant="secondary"
        value={timezone}
        onChange={(key) => setTimezone(String(key))}
        aria-label={t('preferences.timezone')}
      >
        <Label>{t('preferences.timezone')}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {TIMEZONE_OPTIONS.map((tz) => {
              const key = tz.labelKey as TimezoneKey
              const resolvedKey = TIMEZONE_LABEL_KEYS[key] ?? 'timezones.taipei'
              const label = t(resolvedKey)
              return (
                <ListBox.Item key={tz.value} id={tz.value} textValue={String(label)}>
                  {String(label)}
                </ListBox.Item>
              )
            })}
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
      )}

      <div className="pt-4 border-t">
        <label className="mb-2 block text-sm font-medium">{t('preferences.resetToDefaults')}</label>
        <div>
          <Button variant="danger" onPress={handleResetClick} className="rounded-full">
            {t('preferences.resetBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}
