import { useLocation, useNavigate } from 'react-router-dom'
import { useTimerStore } from '@renderer/stores/timer'
import { isTimerRoute } from '@renderer/lib/routes'
import TimerRing from '@renderer/components/Timer/TimerRing'

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
  if (isTimerRoute(location.pathname)) return null

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
      <TimerRing progress={progress * 100} size={60} color="accent">
        <span className="timer-digits text-xs font-bold">{formatMMSS(remainingSeconds)}</span>
      </TimerRing>
    </div>
  )
}
