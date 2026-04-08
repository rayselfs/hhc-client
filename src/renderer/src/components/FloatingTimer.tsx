import { useLocation, useNavigate } from 'react-router-dom'
import { ProgressCircle } from '@heroui/react'
import { useTimerStore } from '@renderer/stores/timer'

function formatMMSS(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return (
    Math.floor(s / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (s % 60).toString().padStart(2, '0')
  )
}

export default function FloatingTimer(): React.JSX.Element | null {
  const location = useLocation()
  const navigate = useNavigate()
  const status = useTimerStore((s) => s.status)
  const progress = useTimerStore((s) => s.progress)
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds)

  if (status !== 'running') return null
  if (location.pathname === '/timer') return null

  return (
    <div
      role="button"
      tabIndex={0}
      className="fixed bottom-4 right-4 z-50 w-20 h-20 cursor-pointer flex items-center justify-center hover:scale-105 transition-transform"
      onClick={() => navigate('/timer')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate('/timer')
      }}
      aria-label="Go to timer"
    >
      <div style={{ width: 60, height: 60 }}>
        <ProgressCircle
          value={progress * 100}
          color="accent"
          aria-label="Timer progress"
          className="w-full h-full"
        >
          <span className="timer-digits text-xs font-bold">{formatMMSS(remainingSeconds)}</span>
        </ProgressCircle>
      </div>
    </div>
  )
}
