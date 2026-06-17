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

export default function GeneralSettings(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { resolved, setPreference } = useTheme()
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration)
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
