import { useState, useEffect } from 'react'

interface ClockDisplayProps {
  className?: string
}

function getCurrentTime(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function ClockDisplay({ className }: ClockDisplayProps): React.JSX.Element {
  const [time, setTime] = useState(getCurrentTime)

  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`@container w-full ${className ?? ''}`} data-testid="clock-display">
      <span className="timer-digits font-bold tabular-nums text-[24cqi] block text-center">
        {time}
      </span>
    </div>
  )
}
