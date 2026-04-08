import ProgressRing from '@renderer/components/Timer/ProgressRing'

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
}: TimerDisplayProps) {
  const isWarning = phase === 'warning'
  const isOvertime = phase === 'overtime'
  const ringColor = isWarning ? 'error' : 'primary'
  const isClickable = Boolean(onTimeClick)

  const innerContent = isOvertime ? overtimeMessage || overtimeDisplay || '00:00' : mainDisplay

  const fontSize = `${Math.round((size / 280) * 36)}px`

  return (
    <div
      className={`flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <ProgressRing
        value={progress * 100}
        color={ringColor}
        size={size}
        isWarning={isWarning}
        aria-label="Timer progress"
      >
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={isClickable ? onTimeClick : undefined}
            className={[
              'font-mono font-bold bg-transparent border-0 p-0',
              isWarning ? 'text-danger' : '',
              isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default pointer-events-none'
            ].join(' ')}
            style={{ fontSize }}
            aria-label={isClickable ? 'Set timer duration' : undefined}
          >
            {innerContent}
          </button>
          {!isOvertime && subDisplay && (
            <span className="text-sm text-default-500">{subDisplay}</span>
          )}
        </div>
      </ProgressRing>
    </div>
  )
}
