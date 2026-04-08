import { useTranslation } from 'react-i18next'

export default function TimerPage(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div data-testid="timer-page">
      <h1>{t('timer.title')}</h1>
    </div>
  )
}
