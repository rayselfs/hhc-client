import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardPageContent(): React.JSX.Element {
  const board = useSoundboardStore((state) => state.getSelectedBoard())
  const scene = useSoundboardStore((state) => state.getSelectedScene())

  return (
    <main
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      data-testid="soundboard-page-content"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Soundboard</h1>
          <p className="text-xs text-muted">
            {board.name} / {scene?.name ?? 'No scene'}
          </p>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center text-sm text-muted">
        Soundboard workspace
      </div>
    </main>
  )
}
