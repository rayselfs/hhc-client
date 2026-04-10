import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Switch, Select, ListBox } from '@heroui/react'
import { Label } from 'react-aria-components'
import { useTheme } from '@renderer/contexts/ThemeContext'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'
import ConfirmDialog from '@renderer/components/ConfirmDialog'

const TIMEZONE_LABEL_KEYS = {
  'timezones.taipei': 'timezones.taipei',
  'timezones.hongKong': 'timezones.hongKong',
  'timezones.singapore': 'timezones.singapore',
  'timezones.tokyo': 'timezones.tokyo',
  'timezones.seoul': 'timezones.seoul',
  'timezones.newYork': 'timezones.newYork',
  'timezones.london': 'timezones.london',
  'timezones.paris': 'timezones.paris',
  'timezones.utc': 'timezones.utc'
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
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const languageOptions = [
    { value: 'en', label: t('preferences.languageNames.en') },
    { value: 'zh-TW', label: t('preferences.languageNames.zhTW') },
    { value: 'zh-CN', label: t('preferences.languageNames.zhCN') }
  ]

  const handleResetConfirm = (): void => {
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
              const resolvedKey = TIMEZONE_LABEL_KEYS[key] ?? 'timezones.utc'
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
          <button
            className="rounded-lg bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger-soft-foreground hover:bg-danger-soft-hover transition-colors"
            onClick={() => setResetConfirmOpen(true)}
          >
            {t('preferences.resetBtn')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        description={t('preferences.resetToDefaultsConfirm')}
        onConfirm={handleResetConfirm}
      />
    </div>
  )
}
