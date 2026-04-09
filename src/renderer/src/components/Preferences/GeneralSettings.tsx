import { useTranslation } from 'react-i18next'
import { Switch, Select } from '@heroui/react'
import { useTheme } from '@renderer/contexts/ThemeContext'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'

interface GeneralSettingsProps {}

export default function GeneralSettings(_props: GeneralSettingsProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { preference, setPreference } = useTheme()
  const { timezone, hardwareAcceleration, setTimezone, setHardwareAcceleration, resetToDefaults } =
    useSettingsStore()

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'zh-CN', label: '简体中文' }
  ]

  const handleReset = (): void => {
    if (window.confirm(t('preferences.resetToDefaultsConfirm'))) {
      resetToDefaults()
      setPreference('system')
      i18n.changeLanguage('en')
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('preferences.language')}</label>
        <Select.Root
          selectedKey={i18n.language}
          onSelectionChange={(key) => i18n.changeLanguage(String(key))}
          aria-label={t('preferences.language')}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            {languageOptions.map((opt) => (
              <button
                key={opt.value}
                data-value={opt.value}
                onClick={() => i18n.changeLanguage(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </Select.Popover>
        </Select.Root>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t('preferences.timezone')}</label>
        <Select.Root
          selectedKey={timezone}
          onSelectionChange={(key) => setTimezone(String(key))}
          aria-label={t('preferences.timezone')}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            {TIMEZONE_OPTIONS.map((tz) => {
              const tzLabelKeys = {
                'timezones.taipei': t('timezones.taipei'),
                'timezones.hongKong': t('timezones.hongKong'),
                'timezones.singapore': t('timezones.singapore'),
                'timezones.tokyo': t('timezones.tokyo'),
                'timezones.seoul': t('timezones.seoul'),
                'timezones.newYork': t('timezones.newYork'),
                'timezones.london': t('timezones.london'),
                'timezones.paris': t('timezones.paris'),
                'timezones.utc': t('timezones.utc')
              } as const
              const label = tzLabelKeys[tz.labelKey as keyof typeof tzLabelKeys] ?? tz.labelKey
              return (
                <button key={tz.value} data-value={tz.value} onClick={() => setTimezone(tz.value)}>
                  {label}
                </button>
              )
            })}
          </Select.Popover>
        </Select.Root>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{t('preferences.darkMode')}</label>
        <Switch
          isSelected={preference === 'dark'}
          onChange={(checked) => setPreference(checked ? 'dark' : 'light')}
          aria-label={t('preferences.darkMode')}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>

      {isElectron() && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('preferences.hardwareAcceleration')}</label>
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
        <button
          className="text-sm text-red-500 hover:text-red-700 font-medium"
          onClick={handleReset}
        >
          {t('preferences.resetToDefaults')}
        </button>
      </div>
    </div>
  )
}
