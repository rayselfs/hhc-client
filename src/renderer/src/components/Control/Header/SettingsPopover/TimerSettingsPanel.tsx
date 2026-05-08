import { useTranslation } from 'react-i18next'
import { Switch } from '@heroui/react/switch'
import { Input } from '@heroui/react/input'
import { ColorPicker } from '@heroui/react/color-picker'
import { ColorSwatch } from '@heroui/react/color-swatch'
import { toast } from '@heroui/react/toast'
import { parseColor } from 'react-aria-components'
import type { Color } from 'react-aria-components'
import { useTimerStore, DEFAULT_SETTINGS } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useSettingsStore } from '@renderer/stores/settings'
import { Suspense, lazy, useRef, useState } from 'react'
import type { TFunction } from 'i18next'

const REMINDER_MIN = 10
const REMINDER_MAX = 3600

const LazyColorPickerContent = lazy(async () => {
  const { ColorArea, ColorSlider } = await import('@heroui/react')
  const Component = ({ t }: { t: TFunction }): React.JSX.Element => (
    <>
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
    </>
  )
  return { default: Component }
})

interface TimerSettingsPanelProps {
  isStopwatch: boolean
}

export default function TimerSettingsPanel({
  isStopwatch
}: TimerSettingsPanelProps): React.JSX.Element {
  const { t } = useTranslation()

  const reminderEnabled = useTimerStore((s) => s.reminderEnabled)
  const reminderDuration = useTimerStore((s) => s.reminderDuration)
  const reminderColor = useTimerStore((s) => s.reminderColor)
  const overtimeMessageEnabled = useTimerStore((s) => s.overtimeMessageEnabled)
  const overtimeMessage = useTimerStore((s) => s.overtimeMessage)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const status = useTimerStore((s) => s.status)
  const setReminder = useTimerStore((s) => s.setReminder)
  const setOvertimeMessage = useTimerStore((s) => s.setOvertimeMessage)

  const timerRingColor = useSettingsStore((s) => s.timerRingColor)
  const timerRingColorEnabled = useSettingsStore((s) => s.timerRingColorEnabled)
  const setTimerRingColor = useSettingsStore((s) => s.setTimerRingColor)
  const setTimerRingColorEnabled = useSettingsStore((s) => s.setTimerRingColorEnabled)

  const showOnProjection = useStopwatchStore((s) => s.showOnProjection)
  const setShowOnProjection = useStopwatchStore((s) => s.setShowOnProjection)

  const [editingValue, setEditingValue] = useState<string | null>(null)
  const focusSinkRef = useRef<HTMLDivElement>(null)

  const inputValue = editingValue ?? String(reminderDuration)

  const canEnableReminder = totalDuration > 30
  const isTimerRunning = status !== 'stopped'
  const reminderInputDisabled = isTimerRunning || !reminderEnabled

  const validateReminderInput = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed === '') return t('toast.reminderDurationEmpty')
    if (!/^\d+$/.test(trimmed)) return t('toast.reminderDurationInvalid')
    const val = parseInt(trimmed, 10)
    if (val < REMINDER_MIN || val > REMINDER_MAX) return t('timer.reminder.errorRange')
    if (val >= totalDuration) return t('timer.reminder.error')
    return null
  }

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

  const handleReminderDurationFocus = (): void => {
    setEditingValue(inputValue)
  }

  const handleReminderDurationChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEditingValue(e.target.value)
  }

  const handleReminderDurationEnter = (): void => {
    const error = validateReminderInput(editingValue ?? '')
    if (error !== null) {
      toast.danger(error)
      return
    }
    focusSinkRef.current?.focus()
  }

  const handleReminderDurationBlur = (): void => {
    const current = inputValue
    setEditingValue(null)
    const error = validateReminderInput(current)
    if (error !== null) {
      toast.danger(error)
      return
    }
    setReminder(reminderEnabled, parseInt(current.trim(), 10))
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

  const handleTimerRingColorChange = (color: Color): void => {
    setTimerRingColor(color.toString('hex'))
  }

  const parsedColor = parseColor(reminderColor)
  const parsedRingColor = parseColor(timerRingColor)

  if (isStopwatch) {
    return (
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
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={focusSinkRef} tabIndex={-1} className="sr-only" />
      <div className="flex items-center gap-2 min-h-10">
        <Switch
          isSelected={reminderEnabled}
          isDisabled={!canEnableReminder || (isTimerRunning && !reminderEnabled)}
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
            type="text"
            inputMode="numeric"
            variant="secondary"
            value={inputValue}
            onFocus={handleReminderDurationFocus}
            onChange={handleReminderDurationChange}
            onBlur={handleReminderDurationBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleReminderDurationEnter()}
            aria-label={t('timer.reminder.time')}
            className="w-21 [&_input]:py-1 [&_input]:text-center rounded-full px-4"
            disabled={reminderInputDisabled}
          />
          <span className="text-xs text-muted shrink-0">{t('timer.reminder.seconds')}</span>
          <ColorPicker value={parsedColor} onChange={handleReminderColorChange}>
            <ColorPicker.Trigger isDisabled={reminderInputDisabled} className="self-stretch">
              <ColorSwatch
                aria-label={t('timer.reminder.color')}
                className={`aspect-square h-full rounded cursor-pointer ${reminderInputDisabled ? 'opacity-40' : ''}`}
              />
            </ColorPicker.Trigger>
            <ColorPicker.Popover placement="bottom end" className="gap-2 px-2 py-3 w-52">
              <Suspense
                fallback={<div className="w-8 h-8 rounded-full bg-default-200 animate-pulse" />}
              >
                <LazyColorPickerContent t={t} />
              </Suspense>
            </ColorPicker.Popover>
          </ColorPicker>
        </div>
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
          onKeyDown={(e) => e.key === 'Enter' && focusSinkRef.current?.focus()}
          placeholder={t('timer.overtimeMessage.placeholder')}
          aria-label={t('timer.overtimeMessage.label')}
          maxLength={15}
          disabled={!overtimeMessageEnabled}
          className="w-33 ml-auto [&_input]:py-1 rounded-full px-4"
        />
      </div>

      <div className="flex items-center gap-2 min-h-10">
        <Switch
          isSelected={timerRingColorEnabled}
          onChange={setTimerRingColorEnabled}
          aria-label={t('timer.ringColor.label')}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-sm">{t('timer.ringColor.label')}</span>
        </Switch>
        <ColorPicker value={parsedRingColor} onChange={handleTimerRingColorChange}>
          <ColorPicker.Trigger isDisabled={!timerRingColorEnabled} className="self-stretch">
            <ColorSwatch
              aria-label={t('timer.ringColor.label')}
              className={`aspect-square h-full rounded cursor-pointer ml-auto ${!timerRingColorEnabled ? 'opacity-40' : ''}`}
            />
          </ColorPicker.Trigger>
          <ColorPicker.Popover placement="bottom end" className="gap-2 px-2 py-3 w-52">
            <Suspense
              fallback={<div className="w-8 h-8 rounded-full bg-default-200 animate-pulse" />}
            >
              <LazyColorPickerContent t={t} />
            </Suspense>
          </ColorPicker.Popover>
        </ColorPicker>
      </div>
    </div>
  )
}
