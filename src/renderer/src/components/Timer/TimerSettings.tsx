import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch, Input } from '@heroui/react'
import { Settings } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'

interface TimerSettingsProps {
  className?: string
}

const MAX_OVERTIME_MESSAGE_LENGTH = 15

export default function TimerSettings({ className }: TimerSettingsProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

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
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('timer.settings')}
        aria-expanded={isOpen}
        className="flex items-center justify-center rounded-md p-1.5 text-sm hover:bg-white/10 transition-colors"
      >
        <Settings className="size-4" />
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label={t('timer.settings')}
          className="mt-2 rounded-xl border border-white/10 bg-white/5 p-4 space-y-4"
        >
          <div className="flex items-center gap-4">
            <Switch
              isSelected={reminderEnabled}
              onChange={handleReminderToggle}
              aria-label={t('timer.reminder.label')}
            >
              <span className="text-sm">{t('timer.reminder.label')}</span>
            </Switch>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={String(reminderDuration)}
                onChange={handleReminderDurationChange}
                aria-label={t('timer.reminder.time')}
                className="w-20"
                min={0}
              />
              <span className="text-xs text-white/60">{t('timer.reminder.seconds')}</span>
            </div>
          </div>
          {reminderError && (
            <p role="alert" className="text-xs text-red-400 -mt-2">
              {reminderError}
            </p>
          )}

          <div className="flex items-center gap-4">
            <Switch
              isSelected={overtimeMessageEnabled}
              onChange={handleOvertimeMessageToggle}
              aria-label={t('timer.overtimeMessage.label')}
            >
              <span className="text-sm">{t('timer.overtimeMessage.label')}</span>
            </Switch>
            <Input
              type="text"
              value={overtimeMessage}
              onChange={handleOvertimeMessageChange}
              placeholder={t('timer.overtimeMessage.placeholder')}
              aria-label={t('timer.overtimeMessage.label')}
              maxLength={MAX_OVERTIME_MESSAGE_LENGTH}
              className="w-40"
            />
          </div>
        </div>
      )}
    </div>
  )
}
