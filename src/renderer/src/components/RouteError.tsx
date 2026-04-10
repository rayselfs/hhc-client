import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function RouteError(): React.JSX.Element {
  const error = useRouteError()
  const { t } = useTranslation()

  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold text-danger">{t('error.pageError')}</h1>
      <pre className="max-w-xl overflow-auto rounded bg-default-100 p-4 text-sm">{message}</pre>
    </div>
  )
}
