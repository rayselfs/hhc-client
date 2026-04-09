import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { useTimerStore } from '@renderer/stores/timer'

const ADJUSTMENTS = [10, 30, 60]

interface TimeAdjustmentProps {
  className?: string
}

export default function TimeAdjustment({ className }: TimeAdjustmentProps): React.JSX.Element {
  const { t } = useTranslation()
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds)
  const addTime = useTimerStore((s) => s.addTime)
  const removeTime = useTimerStore((s) => s.removeTime)

  return (
    <div className={className}>
      <div className="flex items-center gap-2 justify-center mb-3">
        {ADJUSTMENTS.map((seconds) => (
          <Button
            key={`remove-${seconds}`}
            variant="outline"
            className="text-warning border-warning w-16"
            isDisabled={remainingSeconds < seconds}
            onPress={() => removeTime(seconds)}
            aria-label={t('timer.removeTime', { seconds })}
          >
            {t('timer.removeTime', { seconds })}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 justify-center">
        {ADJUSTMENTS.map((seconds) => (
          <Button
            key={`add-${seconds}`}
            variant="outline"
            className="text-accent border-accent w-16"
            onPress={() => addTime(seconds)}
            aria-label={t('timer.addTime', { seconds })}
          >
            {t('timer.addTime', { seconds })}
          </Button>
        ))}
      </div>
    </div>
  )
}
