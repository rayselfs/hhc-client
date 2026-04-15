import { useTranslation } from 'react-i18next'
import { Button, Popover } from '@heroui/react'
import { Settings } from 'lucide-react'
import TimerSettingsPanel from '@renderer/components/Control/Header/SettingsPopover/TimerSettingsPanel'
import BibleSettingsPanel from '@renderer/components/Control/Header/SettingsPopover/BibleSettingsPanel'

export type SettingsVariant = 'timer' | 'bible' | 'stopwatch'

interface SettingsPopoverProps {
  variant: SettingsVariant
}

export default function SettingsPopover({ variant }: SettingsPopoverProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Popover>
      <Button size="lg" isIconOnly variant="outline" aria-label={t('timer.settings')}>
        <Settings className="size-4" />
      </Button>
      <Popover.Content placement="bottom start" className="w-80">
        <Popover.Dialog>
          <section aria-label={t('timer.settings')} className="space-y-3 p-1">
            {variant === 'bible' ? (
              <BibleSettingsPanel />
            ) : (
              <TimerSettingsPanel isStopwatch={variant === 'stopwatch'} />
            )}
          </section>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
