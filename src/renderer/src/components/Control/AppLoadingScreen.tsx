import icon from '@renderer/assets/icon.png'

export default function AppLoadingScreen(): React.JSX.Element {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-[72px] w-[72px] animate-spin rounded-full border-2 border-accent/20 border-t-accent/70" />
        <img src={icon} alt="HHC" className="h-14 w-14 rounded-2xl opacity-90" />
      </div>
    </div>
  )
}
