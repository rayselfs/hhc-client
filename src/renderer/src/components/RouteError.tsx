import { useRouteError, isRouteErrorResponse } from 'react-router-dom'

export default function RouteError(): React.JSX.Element {
  const error = useRouteError()

  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold text-danger">Page Error</h1>
      <pre className="max-w-xl overflow-auto rounded bg-default-100 p-4 text-sm">{message}</pre>
    </div>
  )
}
