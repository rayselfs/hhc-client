import { AlertDialog, Button, useOverlayState } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import {
  useConfirmDialogState,
  type ConfirmDialogStatus
} from '@renderer/contexts/ConfirmDialogContext'

type AlertDialogIconStatus = 'default' | 'accent' | 'success' | 'warning' | 'danger'

type TitleKey = 'common.warning' | 'common.danger' | 'common.info'

const STATUS_TITLES: Record<ConfirmDialogStatus, TitleKey> = {
  warning: 'common.warning',
  danger: 'common.danger',
  info: 'common.info'
}

const STATUS_ALERT: Record<ConfirmDialogStatus, AlertDialogIconStatus> = {
  warning: 'warning',
  danger: 'danger',
  info: 'accent'
}

const STATUS_CONFIRM_VARIANT: Record<ConfirmDialogStatus, 'danger' | 'primary'> = {
  warning: 'danger',
  danger: 'danger',
  info: 'primary'
}

export default function ConfirmDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const { pending, settle } = useConfirmDialogState()
  const state = useOverlayState()

  useEffect(() => {
    if (pending) {
      state.open()
    } else {
      state.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  if (!pending) return <></>

  const { status = 'warning', title, description, confirmLabel, cancelLabel } = pending.options
  const resolvedTitle = title !== undefined ? title : t(STATUS_TITLES[status])
  const alertStatus = STATUS_ALERT[status]
  const confirmVariant = STATUS_CONFIRM_VARIANT[status]

  return (
    <AlertDialog.Backdrop
      isOpen={state.isOpen}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status={alertStatus} />
            <AlertDialog.Heading>{resolvedTitle}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm">{description}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={() => settle(false)}>
              {cancelLabel ?? t('common.cancel')}
            </Button>
            <Button variant={confirmVariant} onPress={() => settle(true)}>
              {confirmLabel ?? t('common.confirm')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
