import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField, Input, Label, Button } from '@heroui/react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { Send } from 'lucide-react'

export default function TimerPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { project, isProjectionOpen } = useProjection()
  const [message, setMessage] = useState('')

  const handleSend = async (): Promise<void> => {
    await project('projection:text', message)
  }

  return (
    <div data-testid="timer-page">
      <h1>{t('timer.title')}</h1>
      <p className="mb-4 text-default-500">{t('timer.placeholder')}</p>

      <div className="flex items-end gap-2">
        <TextField className="max-w-xs" value={message} onChange={setMessage}>
          <Label>{t('timer.sendLabel')}</Label>
          <Input placeholder={t('timer.sendPlaceholder')} />
        </TextField>
        <Button variant="primary" onPress={handleSend}>
          <Send className="size-4" />
          {t('common.send')}
        </Button>
      </div>

      {!isProjectionOpen && (
        <p className="mt-2 text-sm text-warning">{t('timer.projectionClosed')}</p>
      )}
    </div>
  )
}
