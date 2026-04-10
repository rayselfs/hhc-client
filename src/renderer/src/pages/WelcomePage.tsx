import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Select, ListBox, Button } from '@heroui/react'
import { Label } from 'react-aria-components'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'
import { markOnboarded } from '@renderer/lib/onboarding'

function detectLanguage(): string {
  const nav = navigator.language
  if (nav === 'zh-TW' || nav === 'zh-Hant') return 'zh-TW'
  if (nav.startsWith('zh')) return 'zh-CN'
  return 'en'
}

function detectTimezone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (TIMEZONE_OPTIONS.some((option) => option.value === detected)) {
    return detected
  }
  return 'Asia/Taipei'
}

export default function WelcomePage(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [language, setLanguage] = useState(detectLanguage)
  const [timezone, setTimezone] = useState(detectTimezone)

  const handleLanguageChange = (key: string | number): void => {
    const lang = String(key)
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const handleConfirm = (): void => {
    i18n.changeLanguage(language)
    useSettingsStore.getState().setTimezone(timezone)
    markOnboarded()
    navigate('/timer')
  }

  const languageOptions = [
    { value: 'en', label: t('preferences.languageNames.en') },
    { value: 'zh-TW', label: t('preferences.languageNames.zhTW') },
    { value: 'zh-CN', label: t('preferences.languageNames.zhCN') }
  ]

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background text-foreground"
      data-testid="welcome-page"
    >
      <div className="w-full max-w-md space-y-8 rounded-lg bg-content1 p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t('welcome.title')}</h1>
          <p className="mt-2 text-default-500">{t('welcome.subtitle')}</p>
        </div>

        <div className="space-y-6">
          <Select
            value={language}
            onChange={(key) => key !== null && handleLanguageChange(key)}
            aria-label={t('welcome.language')}
          >
            <Label className="mb-2 block text-sm font-medium">{t('welcome.language')}</Label>
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
            value={timezone}
            onChange={(key) => setTimezone(String(key))}
            aria-label={t('welcome.timezone')}
          >
            <Label className="mb-2 block text-sm font-medium">{t('welcome.timezone')}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <ListBox.Item key={tz.value} id={tz.value} textValue={t(tz.labelKey)}>
                    {t(tz.labelKey)}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <Button variant="primary" className="w-full" onPress={handleConfirm}>
          {t('welcome.confirm')}
        </Button>
      </div>
    </div>
  )
}
