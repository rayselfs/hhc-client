import { useTranslation } from 'react-i18next'
import { Slider } from '@heroui/react/slider'
import { Label } from '@heroui/react/label'
import { Switch } from '@heroui/react/switch'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'

export default function BibleSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const fontSize = useBibleSettingsStore((s) => s.fontSize)
  const setFontSize = useBibleSettingsStore((s) => s.setFontSize)
  const speechEnabled = useBibleSettingsStore((s) => s.speechEnabled)
  const setSpeechEnabled = useBibleSettingsStore((s) => s.setSpeechEnabled)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 min-h-10">
        <Switch
          isSelected={speechEnabled}
          onChange={(checked) => setSpeechEnabled(checked)}
          aria-label={t('preferences.bible.speechEnabled')}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-sm">{t('preferences.bible.speechEnabled')}</span>
        </Switch>
      </div>

      <Slider
        defaultValue={fontSize}
        minValue={20}
        maxValue={150}
        step={1}
        onChange={(value) => {
          if (typeof value === 'number') {
            setFontSize(value)
          }
        }}
        className="w-full"
      >
        <Label>{t('bible.settings.fontSize')}</Label>
        <Slider.Output className="text-sm text-muted-fg" />
        <Slider.Track className="mt-3 h-2 rounded-full bg-surface-secondary">
          <Slider.Fill className="bg-accent" />
          <Slider.Thumb className="size-4 rounded-full bg-accent" />
        </Slider.Track>
      </Slider>
    </div>
  )
}
