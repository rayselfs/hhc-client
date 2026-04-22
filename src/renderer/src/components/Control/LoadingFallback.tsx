export default function LoadingFallback(): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
    </div>
  )
}
