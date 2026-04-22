import { memo, useState, useEffect } from 'react'
import { useSettingsStore } from '@renderer/stores/settings'

interface ClockDisplayProps {
  className?: string
}

const clockFormatter = (timezone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    hour12: false
  })

function getCurrentTime(timezone: string): string {
  return clockFormatter(timezone).format(new Date())
}

export default memo(function ClockDisplay({ className }: ClockDisplayProps): React.JSX.Element {
  const timezone = useSettingsStore((s) => s.timezone)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [timezone])

  void tick
  const time = getCurrentTime(timezone)

  return (
    <div className={`@container w-full ${className ?? ''}`} data-testid="clock-display">
      <span className="timer-digits font-bold tabular-nums text-[24cqi] block text-center">
        {time}
      </span>
    </div>
  )
})
