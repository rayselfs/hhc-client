import { Tabs } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerMode } from '@shared/types/timer'

const TIMER_MODES: TimerMode[] = ['timer', 'both', 'clock']
const OTHER_MODES: TimerMode[] = ['stopwatch']

const TAB_CLASS =
  'border border-transparent data-[selected=true]:border-accent data-[selected=true]:text-accent rounded-2xl'

export default function ModeSelector(): React.JSX.Element {
  const { t } = useTranslation()
  const mode = useTimerStore((s) => s.mode)
  const setMode = useTimerStore((s) => s.setMode)

  return (
    <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(key as TimerMode)}>
      <Tabs.ListContainer>
        <Tabs.List className="bg-transparent p-0 gap-1">
          {TIMER_MODES.map((m) => (
            <Tabs.Tab key={m} id={m} data-testid={`mode-${m}`} className={TAB_CLASS}>
              {t(`timer.mode.${m}`)}
              <Tabs.Indicator className="hidden" />
            </Tabs.Tab>
          ))}
          {OTHER_MODES.map((m) => (
            <Tabs.Tab key={m} id={m} data-testid={`mode-${m}`} className={TAB_CLASS}>
              <Tabs.Separator />
              {t(`timer.mode.${m}`)}
              <Tabs.Indicator className="hidden" />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
