import { useTranslation } from 'react-i18next'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { Button, Modal, useOverlayState } from '@heroui/react'
import { X, TriangleAlert, Monitor, MonitorOff } from 'lucide-react'

export default function Header(): React.JSX.Element {
  const { t } = useTranslation()
  const { isProjectionOpen, isProjectionBlanked, closeProjection, blankProjection } =
    useProjection()
  const state = useOverlayState()

  return (
    <>
      <header className="flex items-center justify-end gap-2 p-2">
        <Button
          isIconOnly
          variant={isProjectionBlanked ? 'outline' : 'danger-soft'}
          onPress={() => blankProjection(!isProjectionBlanked)}
          isDisabled={!isProjectionOpen}
          aria-label={t(isProjectionBlanked ? 'projection.showButton' : 'projection.blankButton')}
        >
          {isProjectionBlanked ? <Monitor className="size-4" /> : <MonitorOff className="size-4" />}
        </Button>
        <Button
          isIconOnly
          variant="outline"
          className="text-danger"
          onPress={state.open}
          isDisabled={!isProjectionOpen}
          aria-label={t('projection.closeButton')}
        >
          <X className="size-4" />
        </Button>
      </header>
      <Modal.Root state={state}>
        <Modal.Trigger />
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="p-2 pl-5 pt-5">
              <Modal.Header>
                <Modal.Icon className="text-danger">
                  <TriangleAlert className="size-6" />
                </Modal.Icon>
                <Modal.Heading>{t('projection.closeTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{t('projection.closeConfirm')}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="ghost">
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  onPress={async () => {
                    await closeProjection().catch(() => undefined)
                    state.close()
                  }}
                >
                  {t('common.close')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </>
  )
}
