import { Popover, Button, Input } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseDuration } from '@renderer/lib/parse-duration'

interface TimeInputPopoverProps {
  onConfirm: (seconds: number) => void
  children: React.ReactNode
  isDisabled?: boolean
}

export default function TimeInputPopover({
  onConfirm,
  children,
  isDisabled
}: TimeInputPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = (): void => {
    const seconds = parseDuration(value.trim())
    if (seconds === null) {
      setError(t('timer.inputDialog.invalid'))
      return
    }
    onConfirm(seconds)
    setValue('')
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleConfirm()
  }

  if (isDisabled) {
    return <>{children}</>
  }

  return (
    <Popover>
      <Popover.Trigger>{children}</Popover.Trigger>
      <Popover.Content>
        <Popover.Dialog>
          <div className="p-3 flex flex-col gap-2 w-72 h-28">
            <Input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('timer.inputDialog.placeholder')}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'time-input-popover-error' : undefined}
            />
            <p
              id="time-input-popover-error"
              className={`text-xs text-danger ${error ? 'visible' : 'invisible'}`}
            >
              {error || '\u00A0'}
            </p>
            <div className="flex justify-end mt-auto">
              <Button variant="primary" size="sm" onPress={handleConfirm}>
                {t('timer.inputDialog.confirm')}
              </Button>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
