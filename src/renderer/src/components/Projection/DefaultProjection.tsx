import { useTranslation } from 'react-i18next'

export default function DefaultProjection(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <p className="text-white/10 text-4xl font-bold tracking-widest">{t('app.name')}</p>
    </div>
  )
}
