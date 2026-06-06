import icon from '@renderer/assets/icon.png'

export default function AppLoadingScreen(): React.JSX.Element {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-5 bg-background text-foreground">
      <img src={icon} alt="HHC" className="h-14 w-14 rounded-2xl opacity-90" />
      <div className="h-0.5 w-40 animate-pulse rounded-full bg-accent/40" />
    </div>
  )
}
