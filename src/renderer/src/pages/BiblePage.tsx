import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { useProjection } from '@renderer/contexts/ProjectionContext'

export default function BiblePage(): React.JSX.Element {
  const { t } = useTranslation()
  const { project, claimProjection } = useProjection()

  const handleSampleVerse = (): void => {
    claimProjection('bible', { unblank: true })
    project('bible:verse', {
      reference: 'John 3:16',
      text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
      fontSize: 90
    })
  }

  return (
    <div data-testid="bible-page">
      <h1>{t('bible.title')}</h1>
      <p>{t('bible.placeholder')}</p>
      <Button variant="primary" className="mt-4" onPress={handleSampleVerse}>
        Sample: Project John 3:16
      </Button>
    </div>
  )
}
