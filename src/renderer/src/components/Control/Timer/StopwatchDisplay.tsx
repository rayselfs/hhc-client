import TimerRing from './TimerRing'

interface StopwatchDisplayProps {
  formattedTime: string
  size?: number
  responsive?: boolean
  className?: string
}

export default function StopwatchDisplay({
  formattedTime,
  size = 280,
  responsive = false,
  className
}: StopwatchDisplayProps): React.JSX.Element {
  return (
    <TimerRing
      progress={100}
      size={size}
      color="accent"
      responsive={responsive}
      className={`flex items-center justify-center @container ${className ?? ''}`}
    >
      <span className="timer-digits text-[34cqi] tabular-nums" data-testid="stopwatch-display">
        {formattedTime}
      </span>
    </TimerRing>
  )
}
