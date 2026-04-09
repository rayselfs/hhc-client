import { useTranslation } from 'react-i18next'
import { Switch, Input } from '@heroui/react'
import { useTimerStore } from '@renderer/stores/timer'

const MAX_OVERTIME_MESSAGE_LENGTH = 15

interface TimerSettingsProps {
  className?: string
}

export default function TimerSettings({ className }: TimerSettingsProps): React.JSX.Element {
  const { t } = useTranslation()

  const reminderEnabled = useTimerStore((s) => s.reminderEnabled)
  const reminderDuration = useTimerStore((s) => s.reminderDuration)
  const overtimeMessageEnabled = useTimerStore((s) => s.overtimeMessageEnabled)
  const overtimeMessage = useTimerStore((s) => s.overtimeMessage)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const setReminder = useTimerStore((s) => s.setReminder)
  const setOvertimeMessage = useTimerStore((s) => s.setOvertimeMessage)

  const reminderError =
    reminderEnabled && reminderDuration >= totalDuration ? t('timer.reminder.error') : null

  const handleReminderToggle = (enabled: boolean): void => {
    setReminder(enabled, reminderDuration)
  }

  const handleReminderDurationChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 0) {
      setReminder(reminderEnabled, val)
    }
  }

  const handleOvertimeMessageToggle = (enabled: boolean): void => {
    setOvertimeMessage(enabled, overtimeMessage)
  }

  const handleOvertimeMessageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const text = e.target.value.slice(0, MAX_OVERTIME_MESSAGE_LENGTH)
    setOvertimeMessage(overtimeMessageEnabled, text)
  }

  return (
    <div role="region" aria-label={t('timer.settings')} className={`space-y-2 ${className ?? ''}`}>
      <h3 className="text-base font-medium mb-2">{t('timer.timerSettings')}</h3>
      <div className="flex items-center gap-4 min-h-10">
        <Switch
          isSelected={reminderEnabled}
          onChange={handleReminderToggle}
          aria-label={t('timer.reminder.label')}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-sm">{t('timer.reminder.label')}</span>
        </Switch>
        {reminderEnabled && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={String(reminderDuration)}
              onChange={handleReminderDurationChange}
              aria-label={t('timer.reminder.time')}
              className="w-20 [&_input]:py-1"
              min={0}
            />
            <span className="text-xs text-muted">{t('timer.reminder.seconds')}</span>
          </div>
        )}
      </div>
      {reminderError && (
        <p role="alert" className="text-xs text-danger">
          {reminderError}
        </p>
      )}

      <div className="flex items-center gap-4 min-h-10">
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
        {overtimeMessageEnabled && (
          <Input
            type="text"
            value={overtimeMessage}
            onChange={handleOvertimeMessageChange}
            placeholder={t('timer.overtimeMessage.placeholder')}
            aria-label={t('timer.overtimeMessage.label')}
            maxLength={MAX_OVERTIME_MESSAGE_LENGTH}
            className="w-40 [&_input]:py-1"
          />
        )}
      </div>
    </div>
  )
}
