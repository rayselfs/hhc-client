import { ProgressCircle } from '@heroui/react'

interface TimerDisplayProps {
  progress: number
  mainDisplay: string
  subDisplay?: string | null
  phase: 'idle' | 'main' | 'warning' | 'overtime'
  overtimeDisplay?: string | null
  overtimeMessage?: string
  size?: number
  onTimeClick?: () => void
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
  onTimeClick,
  className
}: TimerDisplayProps): React.JSX.Element {
  const isWarning = phase === 'warning'
  const isOvertime = phase === 'overtime'
  const color = isWarning ? 'danger' : 'accent'
  const isClickable = Boolean(onTimeClick)

  const innerContent = isOvertime ? overtimeMessage || overtimeDisplay || '00:00' : mainDisplay

  return (
    <div
      className={`flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <ProgressCircle
        value={progress * 100}
        color={color}
        aria-label="Timer progress"
        className="w-full h-full"
      >
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={isClickable ? onTimeClick : undefined}
            className={[
              'timer-digits font-bold text-4xl bg-transparent border-0 p-0',
              isWarning ? 'text-danger' : '',
              isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default pointer-events-none'
            ].join(' ')}
            aria-label={isClickable ? 'Set timer duration' : undefined}
          >
            {innerContent}
          </button>
          {!isOvertime && subDisplay && (
            <span className="text-sm text-default-500">{subDisplay}</span>
          )}
        </div>
      </ProgressCircle>
    </div>
  )
}
