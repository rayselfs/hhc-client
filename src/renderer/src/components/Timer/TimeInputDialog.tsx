import { Modal, useOverlayState, Button, Input, Label } from '@heroui/react'
import { useState } from 'react'
import { parseDuration } from '@renderer/lib/parse-duration'

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
      setError('Invalid format. Try: 90s, 1m30s, or 03:00')
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
              <Modal.Heading>Set Timer Duration</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-1">
                <Label htmlFor="time-input-dialog-field">Duration</Label>
                <Input
                  id="time-input-dialog-field"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. 1m30s, 90s, 03:00"
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
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onPress={handleConfirm}>
                Set
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
