import { useTranslation } from 'react-i18next'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerMode } from '@shared/types/timer'

interface ModeSelectorProps {
  className?: string
}

const MODES: TimerMode[] = ['timer', 'clock', 'both', 'stopwatch']

export default function ModeSelector({ className }: ModeSelectorProps) {
  const { t } = useTranslation()
  const mode = useTimerStore((s) => s.mode)
  const setMode = useTimerStore((s) => s.setMode)

  return (
    <div className={`flex gap-2 ${className ?? ''}`} role="tablist">
      {MODES.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          role="tab"
          aria-selected={mode === m}
          data-testid={`mode-${m}`}
          className={[
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            mode === m
              ? 'bg-primary text-primary-foreground'
              : 'border border-default text-default-foreground hover:bg-default/20'
          ].join(' ')}
        >
          {t(`timer.mode.${m}`)}
        </button>
      ))}
    </div>
  )
}
