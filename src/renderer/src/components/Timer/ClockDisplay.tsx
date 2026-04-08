import { useState, useEffect } from 'react'

interface ClockDisplayProps {
  size?: number
  className?: string
}

function getCurrentTime(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function ClockDisplay({ size = 64, className }: ClockDisplayProps) {
  const [time, setTime] = useState(getCurrentTime)

  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={`font-mono font-bold tabular-nums ${className ?? ''}`}
      style={{ fontSize: size }}
      data-testid="clock-display"
    >
      {time}
    </div>
  )
}
