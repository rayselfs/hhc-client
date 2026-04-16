import { Modal, useOverlayState, Button, Input, Label } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseDuration } from '@renderer/lib/parse-duration'
import { MAX_DURATION_SECONDS } from '@shared/constants/timer'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

interface TimeInputDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (seconds: number) => void
  initialValue?: string
}

export default function TimeInputDialog({
  isOpen,
  onClose,
  onConfirm,
  initialValue = ''
}: TimeInputDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (open) {
        setValue(initialValue)
        setError(null)
      } else {
        onClose()
      }
    }
  })

  const handleConfirm = (): void => {
    const seconds = parseDuration(value.trim())
    if (seconds === null) {
      setError(t('timer.inputDialog.invalid'))
      return
    }
    if (seconds > MAX_DURATION_SECONDS) {
      setError(t('timer.inputDialog.exceedsMax'))
      return
    }
    onConfirm(seconds)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onClose()
  }

  return (
    <Modal.Root state={state}>
      <Modal.Trigger />
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="p-2 pl-5 pr-5 pt-5">
            <Modal.Header>
              <Modal.Heading>{t('timer.inputDialog.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <ShortcutScope name="overlay">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="time-input-dialog-field">
                    {t('timer.inputDialog.durationLabel')}
                  </Label>
                  <Input
                    id="time-input-dialog-field"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('timer.inputDialog.placeholder')}
                    autoFocus
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'time-input-dialog-error' : undefined}
                  />
                  {error && (
                    <p id="time-input-dialog-error" className="text-sm text-danger">
                      {error}
                    </p>
                  )}
                </div>
              </ShortcutScope>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onPress={handleConfirm}>
                {t('timer.inputDialog.confirm')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
