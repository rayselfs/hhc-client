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
    <div className="flex items-center gap-3">
      {isStopped && (
        <Button
          isIconOnly
          size="lg"
          variant="primary"
          onPress={start}
          data-testid="btn-start"
          aria-label={t('timer.start')}
        >
          <Play className="size-5" />
        </Button>
      )}
      {isRunning && (
        <Button
          isIconOnly
          size="lg"
          variant="outline"
          onPress={pause}
          data-testid="btn-pause"
          aria-label={t('timer.pause')}
        >
          <Pause className="size-5" />
        </Button>
      )}
      {isPaused && (
        <Button
          isIconOnly
          size="lg"
          variant="primary"
          onPress={resume}
          data-testid="btn-resume"
          aria-label={t('timer.resume')}
        >
          <Play className="size-5" />
        </Button>
      )}
      <Button
        isIconOnly
        size="lg"
        variant="ghost"
        onPress={reset}
        isDisabled={isStopped}
        data-testid="btn-reset"
        aria-label={t('timer.reset')}
      >
        <RotateCcw className="size-5" />
      </Button>
    </div>
  )
}
