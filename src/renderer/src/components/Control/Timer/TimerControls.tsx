import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { formatAriaShortcut } from '@renderer/lib/aria'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import type { TimerMode } from '@renderer/stores/timer'

interface TimerControlsProps {
  mode: TimerMode
  disableStart?: boolean
  className?: string
}

export default function TimerControls({
  mode,
  disableStart,
  className
}: TimerControlsProps): React.JSX.Element {
  const { t } = useTranslation()
  const { claimProjection } = useProjection()
  const isStopwatch = mode === 'stopwatch'

  const timerStatus = useTimerStore((s) => s.status)
  const timerPhase = useTimerStore((s) => s.phase)
  const timerStart = useTimerStore((s) => s.start)
  const timerPause = useTimerStore((s) => s.pause)
  const timerResume = useTimerStore((s) => s.resume)
  const timerReset = useTimerStore((s) => s.reset)

  const swStatus = useStopwatchStore((s) => s.status)
  const swStart = useStopwatchStore((s) => s.start)
  const swPause = useStopwatchStore((s) => s.pause)
  const swResume = useStopwatchStore((s) => s.resume)
  const swReset = useStopwatchStore((s) => s.reset)

  const status = isStopwatch ? swStatus : timerStatus
  const phase = isStopwatch ? null : timerPhase
  const start = isStopwatch ? swStart : timerStart
  const pause = isStopwatch ? swPause : timerPause
  const resume = isStopwatch ? swResume : timerResume
  const reset = isStopwatch ? swReset : timerReset

  const isStopped = status === 'stopped'
  const isOvertime = isStopped && phase === 'overtime'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'

  // react-aria filterDOMProps strips aria-keyshortcuts; set imperatively via ref
  const playBtnRef = useRef<HTMLButtonElement>(null)
  const resetBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    playBtnRef.current?.setAttribute(
      'aria-keyshortcuts',
      formatAriaShortcut(SHORTCUTS.TIMER.TOGGLE)
    )
    resetBtnRef.current?.setAttribute(
      'aria-keyshortcuts',
      formatAriaShortcut(SHORTCUTS.TIMER.RESET)
    )
  }, [])

  const handleStart = (): void => {
    claimProjection('timer', { unblank: true })
    start()
  }

  const handleResume = (): void => {
    claimProjection('timer', { unblank: true })
    resume()
  }

  const playAction = isStopped ? handleStart : isPaused ? handleResume : pause
  const playLabel = isStopped ? t('timer.start') : isRunning ? t('timer.pause') : t('timer.resume')

  return (
    <div className={`flex items-center gap-3 ${className || ''}`.trim()}>
      <Button
        ref={playBtnRef}
        isIconOnly
        size="lg"
        variant={isStopped ? 'primary' : 'secondary'}
        className={`h-14 w-14 rounded-full ${isStopped ? '' : 'bg-warning text-accent-foreground'}`}
        onPress={playAction}
        isDisabled={isStopped && disableStart}
        data-testid={isStopped ? 'btn-start' : isRunning ? 'btn-pause' : 'btn-resume'}
        aria-label={playLabel}
      >
        {isRunning ? <Pause className="size-6" /> : <Play className="size-6" />}
      </Button>
      <Button
        ref={resetBtnRef}
        isIconOnly
        size="lg"
        variant="outline"
        className="h-14 w-14 rounded-full"
        onPress={reset}
        isDisabled={isStopped && !isOvertime}
        data-testid="btn-reset"
        aria-label={t('timer.reset')}
      >
        <RotateCcw className="size-6" />
      </Button>
    </div>
  )
}
