import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import type { TimerMode } from '@renderer/stores/timer'

interface TimerControlsProps {
  mode: TimerMode
  disableStart?: boolean
}

export default function TimerControls({
  mode,
  disableStart
}: TimerControlsProps): React.JSX.Element {
  const { t } = useTranslation()
  const isStopwatch = mode === 'stopwatch'

  const timerStatus = useTimerStore((s) => s.status)
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
  const start = isStopwatch ? swStart : timerStart
  const pause = isStopwatch ? swPause : timerPause
  const resume = isStopwatch ? swResume : timerResume
  const reset = isStopwatch ? swReset : timerReset

  const isStopped = status === 'stopped'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'

  const playAction = isStopped ? start : isPaused ? resume : pause
  const playLabel = isStopped ? t('timer.start') : isRunning ? t('timer.pause') : t('timer.resume')

  return (
    <div className="flex items-center gap-3">
      <Button
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
        isIconOnly
        size="lg"
        variant="outline"
        className="h-14 w-14 rounded-full"
        onPress={reset}
        isDisabled={isStopped}
        data-testid="btn-reset"
        aria-label={t('timer.reset')}
      >
        <RotateCcw className="size-6" />
      </Button>
    </div>
  )
}
