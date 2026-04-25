import { useTranslation } from 'react-i18next'
import TimerRing from './TimerRing'
import TimeInputPopover from './TimeInputPopover'

interface TimerDisplayProps {
  progress: number
  mainDisplay: string
  subDisplay?: string | null
  phase: 'idle' | 'main' | 'warning' | 'overtime'
  overtimeDisplay?: string | null
  size?: number
  responsive?: boolean
  warningColor?: string | null
  onTimeConfirm?: (seconds: number) => void
  canEditTime?: boolean
  className?: string
  digitClassName?: string
}

export default function TimerDisplay({
  progress,
  mainDisplay,
  subDisplay,
  phase,
  overtimeDisplay,
  size = 280,
  responsive = false,
  warningColor,
  onTimeConfirm,
  canEditTime,
  className,
  digitClassName
}: TimerDisplayProps): React.JSX.Element {
  const { t } = useTranslation()
  const isWarning = phase === 'warning'
  const isOvertime = phase === 'overtime'
  const useCustomColor = (isWarning || isOvertime) && warningColor

  const innerContent = isOvertime ? overtimeDisplay || '00:00' : mainDisplay

  const digitButton = (
    <button
      type="button"
      className={[
        'timer-digits bg-transparent border-0 p-0 focus:outline-none',
        'text-[34cqi]',
        isWarning && !warningColor ? 'text-danger' : '',
        canEditTime ? 'hover:opacity-80 cursor-pointer' : 'pointer-events-none',
        digitClassName
      ].join(' ')}
      style={useCustomColor ? { color: warningColor } : undefined}
      aria-label={canEditTime ? t('timer.inputDialog.title') : undefined}
    >
      {innerContent}
    </button>
  )

  return (
    <TimerRing
      progress={progress * 100}
      size={size}
      color="accent"
      responsive={responsive}
      className={`flex items-center justify-center @container ${className ?? ''}`}
    >
      <div className="relative flex flex-col items-center">
        {canEditTime && onTimeConfirm ? (
          <TimeInputPopover onConfirm={onTimeConfirm}>{digitButton}</TimeInputPopover>
        ) : (
          digitButton
        )}
        {!isOvertime && subDisplay && (
          <span className="absolute top-[85%] timer-digits text-[14cqi] text-default-500">
            {subDisplay}
          </span>
        )}
      </div>
    </TimerRing>
  )
}
