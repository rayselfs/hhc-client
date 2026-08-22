import { useTranslation } from 'react-i18next'
import { Switch } from '@heroui/react/switch'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Label } from 'react-aria-components'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'

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

export default function TimerSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const timezone = useSettingsStore((s) => s.timezone)
  const setTimezone = useSettingsStore((s) => s.setTimezone)
  const reminderMode = useSettingsStore((s) => s.reminderMode)
  const setReminderMode = useSettingsStore((s) => s.setReminderMode)

  return (
    <div className="p-5 space-y-6">
      <Select
        variant="secondary"
        value={timezone}
        onChange={(key) => setTimezone(String(key))}
        aria-label={t('preferences.timezone')}
      >
        <Label>{t('preferences.timezone')}</Label>
        <Select.Trigger className="rounded-full pl-5">
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
                <ListBox.Item
                  key={tz.value}
                  id={tz.value}
                  textValue={String(label)}
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  {String(label)}
                </ListBox.Item>
              )
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="space-y-2">
        <label className="block text-sm font-medium">
          {t('preferences.timer.reminderModeLabel')}
        </label>
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={reminderMode === 'add'}
            onChange={(checked) => setReminderMode(checked ? 'add' : 'subtract')}
            aria-label={t('preferences.timer.reminderModeLabel')}
            data-testid="switch-reminder-mode"
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm">{t('preferences.timer.reminderModeSwitchLabel')}</span>
          </Switch>
        </div>
      </div>
    </div>
  )
}
