import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch, Select, ListBox, Modal, useOverlayState } from '@heroui/react'
import { Label } from 'react-aria-components'
import { useTheme } from '@renderer/contexts/ThemeContext'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'
import { isElectron } from '@renderer/lib/env'

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

export default function GeneralSettings(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { resolved, setPreference } = useTheme()
  const { timezone, hardwareAcceleration, setTimezone, setHardwareAcceleration, resetToDefaults } =
    useSettingsStore()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const resetConfirmState = useOverlayState({
    isOpen: resetConfirmOpen,
    onOpenChange: setResetConfirmOpen
  })

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'zh-CN', label: '简体中文' }
  ]

  const handleResetConfirm = (): void => {
    resetToDefaults()
    setPreference('system')
    i18n.changeLanguage('en')
    setResetConfirmOpen(false)
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

      <Modal.Root state={resetConfirmState}>
        <Modal.Trigger />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('preferences.resetToDefaults')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm">{t('preferences.resetToDefaultsConfirm')}</p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <button
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-default-100"
                  onClick={() => setResetConfirmOpen(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="rounded-lg bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger-soft-foreground hover:bg-danger-soft-hover transition-colors"
                  onClick={handleResetConfirm}
                >
                  {t('common.confirm')}
                </button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  )
}
