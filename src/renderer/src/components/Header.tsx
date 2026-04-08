import { useTranslation } from 'react-i18next'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { Button, Modal, useOverlayState } from '@heroui/react'
import { X, TriangleAlert } from 'lucide-react'

export default function Header(): React.JSX.Element {
  const { t } = useTranslation()
  const { isProjectionOpen, closeProjection } = useProjection()
  const state = useOverlayState()

  return (
    <>
      <header className="flex items-center justify-end p-2">
        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
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
                  onPress={() => {
                    closeProjection()
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
