import { useTranslation } from 'react-i18next'
import { Slider, Label } from '@heroui/react'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'

export default function BibleSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const fontSize = useBibleSettingsStore((s) => s.fontSize)
  const setFontSize = useBibleSettingsStore((s) => s.setFontSize)

  return (
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
  )
}
