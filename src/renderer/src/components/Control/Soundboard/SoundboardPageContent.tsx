import SoundboardGrid from '@renderer/components/Control/Soundboard/SoundboardGrid'
import SoundboardInspector from '@renderer/components/Control/Soundboard/SoundboardInspector'
import SoundboardLibrary from '@renderer/components/Control/Soundboard/SoundboardLibrary'
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardPageContent(): React.JSX.Element {
  const board = useSoundboardStore((state) => state.getSelectedBoard())
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const mode = useSoundboardStore((state) => state.mode)
  const setMode = useSoundboardStore((state) => state.setMode)

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
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-sm"
          onClick={() => setMode(mode === 'performance' ? 'edit' : 'performance')}
        >
          {mode === 'performance' ? 'Performance' : 'Edit'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <SoundboardLibrary />}
        <SoundboardGrid onTriggerPad={() => undefined} onReleasePad={() => undefined} />
        {mode === 'edit' && <SoundboardInspector />}
      </div>
    </main>
  )
}
