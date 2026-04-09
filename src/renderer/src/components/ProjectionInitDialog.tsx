import { useTranslation } from 'react-i18next'
import { Modal, Button, useOverlayState } from '@heroui/react'
import { Monitor } from 'lucide-react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { isElectron } from '@renderer/lib/env'
import { useEffect } from 'react'

export default function ProjectionInitDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { isProjectionOpen, openProjection } = useProjection()
  const state = useOverlayState()

  useEffect(() => {
    if (!isElectron() && !isProjectionOpen) {
      state.open()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isElectron()) return null

  return (
    <Modal.Root state={state}>
      <Modal.Trigger />
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="p-2 pl-5 pt-5">
            <Modal.Header>
              <Modal.Icon>
                <Monitor className="size-6" />
              </Modal.Icon>
              <Modal.Heading>{t('projection.openTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>{t('projection.openMessage')}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="ghost">
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={async () => {
                  await openProjection().catch(() => undefined)
                  state.close()
                }}
              >
                {t('projection.open')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
