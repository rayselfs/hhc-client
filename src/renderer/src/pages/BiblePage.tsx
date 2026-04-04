import { useTranslation } from 'react-i18next'

export default function BiblePage(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div data-testid="bible-page">
      <h1>{t('bible.title')}</h1>
      <p>{t('bible.placeholder')}</p>
    </div>
  )
}
