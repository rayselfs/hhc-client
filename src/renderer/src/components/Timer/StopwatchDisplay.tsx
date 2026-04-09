interface StopwatchDisplayProps {
  formattedTime: string
  size?: number
  className?: string
}

export default function StopwatchDisplay({
  formattedTime,
  size,
  className
}: StopwatchDisplayProps): React.JSX.Element {
  return (
    <div
      className={`@container w-full ${className ?? ''}`}
      style={size ? { maxWidth: size * 3 } : undefined}
      data-testid="stopwatch-display"
    >
      <span className="timer-digits block text-center text-[34cqi] tabular-nums">
        {formattedTime}
      </span>
    </div>
  )
}
