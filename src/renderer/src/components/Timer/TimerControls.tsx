import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import type { TimerMode } from '@renderer/stores/timer'

interface TimerControlsProps {
  mode: TimerMode
}

export default function TimerControls({ mode }: TimerControlsProps): React.JSX.Element {
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

  return (
    <div className="flex items-center gap-2">
      {isStopped && (
        <Button variant="primary" onPress={start} data-testid="btn-start">
          <Play className="size-4" />
          {t('timer.start')}
        </Button>
      )}
      {isRunning && (
        <>
          <Button variant="outline" onPress={pause} data-testid="btn-pause">
            <Pause className="size-4" />
            {t('timer.pause')}
          </Button>
          <Button variant="ghost" onPress={reset} data-testid="btn-reset">
            <RotateCcw className="size-4" />
            {t('timer.reset')}
          </Button>
        </>
      )}
      {isPaused && (
        <>
          <Button variant="primary" onPress={resume} data-testid="btn-resume">
            <Play className="size-4" />
            {t('timer.resume')}
          </Button>
          <Button variant="ghost" onPress={reset} data-testid="btn-reset">
            <RotateCcw className="size-4" />
            {t('timer.reset')}
          </Button>
        </>
      )}
    </div>
  )
}
