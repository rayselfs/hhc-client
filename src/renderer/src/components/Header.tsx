import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { ButtonGroup, Button, toast } from '@heroui/react'
import { X, Monitor, MonitorOff } from 'lucide-react'
import ModeSelector from '@renderer/components/Timer/ModeSelector'
import { isTimerRoute } from '@renderer/lib/routes'

export default function Header(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const { isProjectionOpen, isProjectionBlanked, closeProjection, blankProjection } =
    useProjection()
  const confirm = useConfirm()

  const showTimerControls = isTimerRoute(location.pathname)

  const handleCloseProjection = async (): Promise<void> => {
    const confirmed = await confirm({
      status: 'danger',
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <ModeSelector />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
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
            className="text-danger px-6"
            onPress={handleCloseProjection}
            isDisabled={!isProjectionOpen}
            aria-label={t('projection.closeButton')}
          >
            <X className="size-4" />
            <ButtonGroup.Separator className="text-default-foreground" />
          </Button>
        </ButtonGroup>
      </div>
    </header>
  )
}
