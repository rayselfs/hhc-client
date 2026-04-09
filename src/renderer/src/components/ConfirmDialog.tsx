import { Modal, useOverlayState } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ConfirmDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  description: string
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
}

export default function ConfirmDialog({
  isOpen,
  onOpenChange,
  description,
  onConfirm,
  confirmLabel,
  cancelLabel
}: ConfirmDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const state = useOverlayState({ isOpen, onOpenChange })

  const handleConfirm = (): void => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Modal.Root state={state}>
      <Modal.Trigger />
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-yellow-500" />
                <Modal.Heading>{t('common.warning')}</Modal.Heading>
              </div>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm">{description}</p>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-default-100"
                onClick={() => onOpenChange(false)}
              >
                {cancelLabel ?? t('common.cancel')}
              </button>
              <button
                className="rounded-lg bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger-soft-foreground hover:bg-danger-soft-hover transition-colors"
                onClick={handleConfirm}
              >
                {confirmLabel ?? t('common.confirm')}
              </button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
