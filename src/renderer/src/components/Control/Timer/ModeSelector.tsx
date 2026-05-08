import { Tabs } from '@heroui/react/tabs'
import { useTranslation } from 'react-i18next'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerMode } from '@shared/types/timer'
import { Timer, Menu, Clock, Watch } from 'lucide-react'

const TIMER_MODES: TimerMode[] = ['timer', 'both', 'clock']
const OTHER_MODES: TimerMode[] = ['stopwatch']

const MODE_ICONS: Record<TimerMode, React.ReactNode> = {
  timer: <Timer size={18} />,
  both: <Menu size={18} />,
  clock: <Clock size={18} />,
  stopwatch: <Watch size={18} />
}

export default function ModeSelector(): React.JSX.Element {
  const { t } = useTranslation()
  const mode = useTimerStore((s) => s.mode)
  const setMode = useTimerStore((s) => s.setMode)

  return (
    <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(key as TimerMode)}>
      <Tabs.ListContainer>
        <Tabs.List className="bg-transparent border border-border p-1 max-lg:gap-1">
          {TIMER_MODES.map((m) => (
            <Tabs.Tab
              key={m}
              id={m}
              data-testid={`mode-${m}`}
              className="max-lg:w-8 max-lg:px-0 data-[selected=true]:text-accent-foreground"
            >
              <span className="max-lg:hidden">{t(`timer.mode.${m}`)}</span>
              <span className="lg:hidden">{MODE_ICONS[m]}</span>
              <Tabs.Indicator className="bg-accent" />
            </Tabs.Tab>
          ))}
          {OTHER_MODES.map((m) => (
            <Tabs.Tab
              key={m}
              id={m}
              data-testid={`mode-${m}`}
              className="max-lg:w-8 max-lg:px-0 data-[selected=true]:text-accent-foreground"
            >
              <Tabs.Separator />
              <span className="max-lg:hidden">{t(`timer.mode.${m}`)}</span>
              <span className="lg:hidden">{MODE_ICONS[m]}</span>
              <Tabs.Indicator className="bg-accent text-default-foreground" />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
