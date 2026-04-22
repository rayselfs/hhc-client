import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { ButtonGroup } from '@heroui/react/button-group'
import { Button } from '@heroui/react/button'
import { toast } from '@heroui/react/toast'
import { X, Monitor, MonitorOff, ExternalLink } from 'lucide-react'
import ModeSelector from '@renderer/components/Control/Timer/ModeSelector'
import SettingsPopover from '@renderer/components/Control/Header/SettingsPopover/SettingsPopover'
import BibleSelector from '@renderer/components/Control/Bible/BibleSelector'
import BibleSearchBar from '@renderer/components/Control/Header/SearchBar/BibleSearchBar'
import { isTimerRoute, isBibleRoute } from '@renderer/lib/routes'
import { EVENTS } from '@renderer/config/events'
import { useTimerStore } from '@renderer/stores/timer'

export default function Header(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const {
    isProjectionOpen,
    isProjectionBlanked,
    openProjection,
    closeProjection,
    blankProjection
  } = useProjection()
  const confirm = useConfirm()
  const mode = useTimerStore((s) => s.mode)

  const showTimerControls = isTimerRoute(location.pathname)
  const showBibleControls = isBibleRoute(location.pathname)

  const handleCloseOrOpenProjection = async (): Promise<void> => {
    if (!isProjectionOpen) {
      await openProjection().catch(() => {
        toast.danger(t('toast.projectionOpenFailed'))
      })
      return
    }
    const confirmed = await confirm({
      status: 'warning',
      title: t('projection.closeTitle'),
      description: t('projection.closeConfirm'),
      confirmLabel: t('common.close'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    await closeProjection().catch(() => {
      toast.danger(t('toast.projectionCloseFailed'))
    })
  }

  const handleOpenBibleSelector = (): void => {
    window.dispatchEvent(new Event(EVENTS.OPEN_BIBLE_SELECTOR))
  }

  return (
    <header className="relative flex items-center justify-end gap-2 p-2">
      {(showTimerControls || showBibleControls) && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <SettingsPopover
            variant={showBibleControls ? 'bible' : mode === 'stopwatch' ? 'stopwatch' : 'timer'}
          />
        </div>
      )}

      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-200 ${showTimerControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
      >
        <div className={showTimerControls ? 'pointer-events-auto' : undefined}>
          <ModeSelector />
        </div>
      </div>

      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-200 ${showBibleControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
      >
        <div className={showBibleControls ? 'pointer-events-auto' : undefined}>
          <div data-testid="bible-header-controls">
            <BibleSelector onOpenDialog={handleOpenBibleSelector} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`transition-all duration-200 ${showBibleControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3 pointer-events-none'}`}
        >
          <BibleSearchBar />
        </div>
        <ButtonGroup size="lg">
          <Button
            isIconOnly
            variant="outline"
            className={isProjectionBlanked ? 'text-default-foreground px-6' : 'text-danger px-6'}
            onPress={() => blankProjection(!isProjectionBlanked)}
            isDisabled={!isProjectionOpen}
            aria-label={t(isProjectionBlanked ? 'projection.showButton' : 'projection.blankButton')}
          >
            {isProjectionBlanked ? (
              <Monitor className="size-4" />
            ) : (
              <MonitorOff className="size-4" />
            )}
          </Button>
          <Button
            isIconOnly
            variant="outline"
            className={isProjectionOpen ? 'text-danger px-6' : 'text-default-foreground px-6'}
            onPress={handleCloseOrOpenProjection}
            aria-label={t(isProjectionOpen ? 'projection.closeButton' : 'projection.openButton')}
          >
            {isProjectionOpen ? <X className="size-4" /> : <ExternalLink className="size-4" />}
            <ButtonGroup.Separator className="text-default-foreground" />
          </Button>
        </ButtonGroup>
      </div>
    </header>
  )
}
