import { Tabs } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerMode } from '@shared/types/timer'

const MODES: TimerMode[] = ['timer', 'clock', 'both', 'stopwatch']

export default function ModeSelector(): React.JSX.Element {
  const { t } = useTranslation()
  const mode = useTimerStore((s) => s.mode)
  const setMode = useTimerStore((s) => s.setMode)

  return (
    <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(key as TimerMode)}>
      <Tabs.ListContainer>
        <Tabs.List>
          {MODES.map((m) => (
            <Tabs.Tab key={m} id={m} data-testid={`mode-${m}`}>
              {t(`timer.mode.${m}`)}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
