import { useTranslation } from 'react-i18next'
import { Slider } from '@heroui/react/slider'
import { Label } from '@heroui/react/label'
import { Switch } from '@heroui/react/switch'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import type { ScriptureDisplayMode } from '@renderer/stores/bible-settings'
import { BUILT_IN_SLIDE_TEMPLATES } from '@renderer/lib/slide-templates'

export default function BibleSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const fontSize = useBibleSettingsStore((s) => s.fontSize)
  const setFontSize = useBibleSettingsStore((s) => s.setFontSize)
  const speechEnabled = useBibleSettingsStore((s) => s.speechEnabled)
  const setSpeechEnabled = useBibleSettingsStore((s) => s.setSpeechEnabled)
  const scriptureDisplayMode = useBibleSettingsStore((s) => s.scriptureDisplayMode)
  const setScriptureDisplayMode = useBibleSettingsStore((s) => s.setScriptureDisplayMode)
  const scriptureTemplateId = useBibleSettingsStore((s) => s.scriptureTemplateId)
  const setScriptureTemplateId = useBibleSettingsStore((s) => s.setScriptureTemplateId)

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

      <Select
        variant="secondary"
        value={scriptureDisplayMode}
        onChange={(key) => setScriptureDisplayMode(String(key) as ScriptureDisplayMode)}
        aria-label={t('bible.settings.displayMode')}
      >
        <Label>{t('bible.settings.displayMode')}</Label>
        <Select.Trigger className="rounded-full pl-5">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item
              id="full-screen"
              textValue={t('bible.settings.displayModeFull')}
              className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
            >
              {t('bible.settings.displayModeFull')}
            </ListBox.Item>
            <ListBox.Item
              id="lower-third"
              textValue={t('bible.settings.displayModeLowerThird')}
              className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
            >
              {t('bible.settings.displayModeLowerThird')}
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        variant="secondary"
        value={scriptureTemplateId}
        onChange={(key) => setScriptureTemplateId(String(key))}
        aria-label={t('bible.settings.template')}
      >
        <Label>{t('bible.settings.template')}</Label>
        <Select.Trigger className="rounded-full pl-5">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {BUILT_IN_SLIDE_TEMPLATES.map((template) => (
              <ListBox.Item
                key={template.id}
                id={template.id}
                textValue={template.name}
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                {template.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

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
