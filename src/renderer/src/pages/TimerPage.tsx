import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField, Input, Label, Button } from '@heroui/react'
import { useProjection } from '@renderer/hooks/useProjection'
import { Send } from 'lucide-react'

export default function TimerPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { send, isProjectionOpen, openProjection } = useProjection()
  const [message, setMessage] = useState('')

  const handleSend = async (): Promise<void> => {
    if (!isProjectionOpen) {
      await openProjection()
    }
    send('projection:text', message)
  }

  return (
    <div data-testid="timer-page">
      <h1>{t('timer.title')}</h1>
      <p className="mb-4 text-default-500">{t('timer.placeholder')}</p>

      <div className="flex items-end gap-2">
        <TextField className="max-w-xs" value={message} onChange={setMessage}>
          <Label>Send to Projection</Label>
          <Input placeholder="Type something..." />
        </TextField>
        <Button variant="primary" onPress={handleSend}>
          <Send className="size-4" />
          Send
        </Button>
      </div>

      {!isProjectionOpen && (
        <p className="mt-2 text-sm text-warning">
          Projection window is closed. Sending will open it first.
        </p>
      )}
    </div>
  )
}
