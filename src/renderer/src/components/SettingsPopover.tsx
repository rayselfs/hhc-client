import { useTranslation } from 'react-i18next'
import {
  Switch,
  Input,
  Button,
  Popover,
  ColorPicker,
  ColorArea,
  ColorSlider,
  ColorSwatch,
  Slider,
  Label
} from '@heroui/react'
import { parseColor } from 'react-aria-components'
import type { Color } from 'react-aria-components'
import { Settings } from 'lucide-react'
import { useTimerStore, DEFAULT_SETTINGS } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import type { TimerMode } from '@renderer/stores/timer'

interface SettingsPopoverProps {
  mode?: TimerMode
}

export default function SettingsPopover({ mode }: SettingsPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const isStopwatch = mode === 'stopwatch'
  const isBibleMode = !mode

  const reminderEnabled = useTimerStore((s) => s.reminderEnabled)
  const reminderDuration = useTimerStore((s) => s.reminderDuration)
  const reminderColor = useTimerStore((s) => s.reminderColor)
  const overtimeMessageEnabled = useTimerStore((s) => s.overtimeMessageEnabled)
  const overtimeMessage = useTimerStore((s) => s.overtimeMessage)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const status = useTimerStore((s) => s.status)
  const setReminder = useTimerStore((s) => s.setReminder)
  const setOvertimeMessage = useTimerStore((s) => s.setOvertimeMessage)

  const showOnProjection = useStopwatchStore((s) => s.showOnProjection)
  const setShowOnProjection = useStopwatchStore((s) => s.setShowOnProjection)

  const fontSize = useBibleSettingsStore((s) => s.fontSize)
  const setFontSize = useBibleSettingsStore((s) => s.setFontSize)

  const canEnableReminder = totalDuration > 30
  const isTimerRunning = status !== 'stopped'
  const reminderInputDisabled = isTimerRunning || !reminderEnabled

  const reminderError =
    reminderEnabled && reminderDuration >= totalDuration ? t('timer.reminder.error') : null

  const handleReminderToggle = (enabled: boolean): void => {
    if (enabled) {
      const duration =
        reminderDuration < totalDuration
          ? reminderDuration
          : totalDuration > 60
            ? 60
            : totalDuration - 10
      setReminder(true, duration)
    } else {
      setReminder(false, reminderDuration)
    }
  }

  const handleReminderDurationChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 0) {
      setReminder(reminderEnabled, val)
    }
  }

  const handleReminderColorChange = (color: Color): void => {
    setReminder(reminderEnabled, reminderDuration, color.toString('hex'))
  }

  const handleOvertimeMessageToggle = (enabled: boolean): void => {
    setOvertimeMessage(enabled, overtimeMessage)
  }

  const handleOvertimeMessageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const MAX_LENGTH = 15
    const text = e.target.value.slice(0, MAX_LENGTH)
    setOvertimeMessage(overtimeMessageEnabled, text)
  }

  const handleOvertimeMessageBlur = (): void => {
    if (overtimeMessage.trim() === '') {
      setOvertimeMessage(overtimeMessageEnabled, DEFAULT_SETTINGS.overtimeMessage)
    }
  }

  const parsedColor = parseColor(reminderColor)

  return (
    <Popover>
      <Button size="lg" isIconOnly variant="outline" aria-label={t('timer.settings')}>
        <Settings className="size-4" />
      </Button>
      <Popover.Content placement="bottom start" className="w-80">
        <Popover.Dialog>
          <section aria-label={t('timer.settings')} className="space-y-3 p-1">
            {isBibleMode ? (
              <div className="space-y-2">
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
                  <Slider.Track className="h-2 rounded-full bg-surface-secondary">
                    <Slider.Fill className="bg-accent" />
                    <Slider.Thumb className="size-4 rounded-full bg-accent" />
                  </Slider.Track>
                </Slider>
                <div className="text-xs text-muted-fg text-center">{fontSize}px</div>
              </div>
            ) : isStopwatch ? (
              <div className="flex items-center gap-3 min-h-10">
                <Switch
                  isSelected={showOnProjection}
                  onChange={() => setShowOnProjection(!showOnProjection)}
                  aria-label={t('timer.stopwatch.showOnProjection')}
                  data-testid="switch-show-stopwatch-projection"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">{t('timer.stopwatch.showOnProjection')}</span>
                </Switch>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 min-h-10">
                    <Switch
                      isSelected={reminderEnabled}
                      isDisabled={!canEnableReminder || isTimerRunning}
                      onChange={handleReminderToggle}
                      aria-label={t('timer.reminder.label')}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <span className="text-sm">{t('timer.reminder.label')}</span>
                    </Switch>
                    <div className="flex items-center gap-1 ml-auto">
                      <Input
                        type="number"
                        variant="secondary"
                        value={String(reminderDuration)}
                        onChange={handleReminderDurationChange}
                        aria-label={t('timer.reminder.time')}
                        className="w-21 [&_input]:py-1 [&_input]:text-center rounded-full px-4"
                        min={0}
                        disabled={reminderInputDisabled}
                      />
                      <span className="text-xs text-muted shrink-0">
                        {t('timer.reminder.seconds')}
                      </span>
                      <ColorPicker value={parsedColor} onChange={handleReminderColorChange}>
                        <ColorPicker.Trigger>
                          <ColorSwatch
                            aria-label={t('timer.reminder.color')}
                            className={`size-7 rounded cursor-pointer ${reminderInputDisabled ? 'opacity-40 pointer-events-none' : ''}`}
                          />
                        </ColorPicker.Trigger>
                        <ColorPicker.Popover
                          placement="bottom end"
                          className="gap-2 px-2 py-3 w-52"
                        >
                          <ColorArea
                            aria-label={t('timer.reminder.color')}
                            className="max-w-full"
                            colorSpace="hsb"
                            xChannel="saturation"
                            yChannel="brightness"
                          >
                            <ColorArea.Thumb />
                          </ColorArea>
                          <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
                            <ColorSlider.Track>
                              <ColorSlider.Thumb />
                            </ColorSlider.Track>
                          </ColorSlider>
                        </ColorPicker.Popover>
                      </ColorPicker>
                    </div>
                  </div>
                  {reminderError && (
                    <p role="alert" className="text-xs text-danger">
                      {reminderError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 min-h-10">
                  <Switch
                    isSelected={overtimeMessageEnabled}
                    onChange={handleOvertimeMessageToggle}
                    aria-label={t('timer.overtimeMessage.label')}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <span className="text-sm">{t('timer.overtimeMessage.label')}</span>
                  </Switch>
                  <Input
                    type="text"
                    variant="secondary"
                    value={overtimeMessage}
                    onChange={handleOvertimeMessageChange}
                    onBlur={handleOvertimeMessageBlur}
                    placeholder={t('timer.overtimeMessage.placeholder')}
                    aria-label={t('timer.overtimeMessage.label')}
                    maxLength={15}
                    disabled={!overtimeMessageEnabled}
                    className="w-33 ml-auto [&_input]:py-1 rounded-full px-4"
                  />
                </div>
              </>
            )}
          </section>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
