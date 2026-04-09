import TimerRing from './TimerRing'
import TimeInputPopover from './TimeInputPopover'

interface TimerDisplayProps {
  progress: number
  mainDisplay: string
  subDisplay?: string | null
  phase: 'idle' | 'main' | 'warning' | 'overtime'
  overtimeDisplay?: string | null
  overtimeMessage?: string
  size?: number
  onTimeConfirm?: (seconds: number) => void
  canEditTime?: boolean
  className?: string
}

export default function TimerDisplay({
  progress,
  mainDisplay,
  subDisplay,
  phase,
  overtimeDisplay,
  overtimeMessage,
  size = 280,
  onTimeConfirm,
  canEditTime,
  className
}: TimerDisplayProps): React.JSX.Element {
  const isWarning = phase === 'warning'
  const isOvertime = phase === 'overtime'

  const innerContent = isOvertime ? overtimeMessage || overtimeDisplay || '00:00' : mainDisplay

  const digitButton = (
    <button
      type="button"
      className={[
        'timer-digits font-light bg-transparent border-0 p-0',
        'text-[30cqi]',
        isWarning ? 'text-danger' : '',
        canEditTime ? 'hover:opacity-80' : 'pointer-events-none'
      ].join(' ')}
      aria-label={canEditTime ? 'Set timer duration' : undefined}
    >
      {innerContent}
    </button>
  )

  return (
    <TimerRing
      progress={progress * 100}
      size={size}
      color="accent"
      responsive
      className={`flex items-center justify-center @container ${className ?? ''}`}
    >
      <div className="relative flex flex-col items-center">
        {canEditTime && onTimeConfirm ? (
          <TimeInputPopover onConfirm={onTimeConfirm}>{digitButton}</TimeInputPopover>
        ) : (
          digitButton
        )}
        {!isOvertime && subDisplay && (
          <span className="absolute top-full timer-digits font-light text-[15cqi] text-default-500">
            {subDisplay}
          </span>
        )}
      </div>
    </TimerRing>
  )
}
