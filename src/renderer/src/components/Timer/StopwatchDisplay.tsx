interface StopwatchDisplayProps {
  formattedTime: string
  size?: number
  className?: string
}

export default function StopwatchDisplay({
  formattedTime,
  size = 64,
  className
}: StopwatchDisplayProps): React.JSX.Element {
  return (
    <div
      className={`timer-digits font-bold tabular-nums ${className ?? ''}`}
      style={{ fontSize: size }}
      data-testid="stopwatch-display"
    >
      {formattedTime}
    </div>
  )
}
