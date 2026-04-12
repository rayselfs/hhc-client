import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { ButtonGroup, Button, toast } from '@heroui/react'
import { X, Monitor, MonitorOff, ExternalLink } from 'lucide-react'
import ModeSelector from '@renderer/components/Timer/ModeSelector'
import SettingsPopover from '@renderer/components/SettingsPopover'
import BibleHeaderControls from '@renderer/components/Bible/BibleHeaderControls'
import BibleSearchBar from '@renderer/components/Bible/BibleSearchBar'
import { isTimerRoute, isBibleRoute } from '@renderer/lib/routes'
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

  return (
    <header className="relative flex items-center justify-end gap-2 p-2">
      {showTimerControls && (
        <>
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <SettingsPopover mode={mode} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              <ModeSelector />
            </div>
          </div>
        </>
      )}
      {showBibleControls && (
        <>
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <SettingsPopover />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              <BibleHeaderControls />
            </div>
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        {showBibleControls && <BibleSearchBar />}
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
