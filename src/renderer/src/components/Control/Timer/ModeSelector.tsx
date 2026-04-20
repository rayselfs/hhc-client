import { Tabs } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerMode } from '@shared/types/timer'

const TIMER_MODES: TimerMode[] = ['timer', 'both', 'clock']
const OTHER_MODES: TimerMode[] = ['stopwatch']

export default function ModeSelector(): React.JSX.Element {
  const { t } = useTranslation()
  const mode = useTimerStore((s) => s.mode)
  const setMode = useTimerStore((s) => s.setMode)

  return (
    <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(key as TimerMode)}>
      <Tabs.ListContainer>
        <Tabs.List className="bg-transparent border border-border p-1">
          {TIMER_MODES.map((m) => (
            <Tabs.Tab
              key={m}
              id={m}
              data-testid={`mode-${m}`}
              className="min-w-20 data-[selected=true]:text-accent-foreground"
            >
              {t(`timer.mode.${m}`)}
              <Tabs.Indicator className="bg-accent" />
            </Tabs.Tab>
          ))}
          {OTHER_MODES.map((m) => (
            <Tabs.Tab
              key={m}
              id={m}
              data-testid={`mode-${m}`}
              className="min-w-20 data-[selected=true]:text-accent-foreground"
            >
              <Tabs.Separator />
              {t(`timer.mode.${m}`)}
              <Tabs.Indicator className="bg-accent text-default-foreground" />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
