import { useTranslation } from 'react-i18next'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Label } from 'react-aria-components'
import { useSettingsStore } from '@renderer/stores/settings'

const RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90, 0] as const

export default function MediaSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays)
  const setTrashRetentionDays = useSettingsStore((s) => s.setTrashRetentionDays)

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
    </div>
  )
}
