import { Square, Volume2 } from 'lucide-react'
import { useSoundboardStore } from '@renderer/stores/soundboard'

interface SoundboardMixerProps {
  onStopAll: () => void
  onFadeAll: () => void
}

export default function SoundboardMixer({
  onStopAll,
  onFadeAll
}: SoundboardMixerProps): React.JSX.Element {
  const masterVolume = useSoundboardStore((state) => state.settings.masterVolume)
  const setMasterVolume = useSoundboardStore((state) => state.setMasterVolume)

  return (
    <footer className="flex items-center gap-3 border-t border-border bg-surface px-3 py-2">
      <label className="flex items-center gap-2 text-xs font-medium">
        <Volume2 className="size-4" />
        Master volume
        <input
          aria-label="Master volume"
          type="number"
          min={0}
          max={100}
          value={Math.round(masterVolume * 100)}
          onChange={(event) => setMasterVolume(Number(event.target.value) / 100)}
          className="w-16 rounded-md border border-border bg-background px-2 py-1"
        />
      </label>
      <button
        type="button"
        onClick={onStopAll}
        className="ml-auto inline-flex items-center gap-2 rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white"
      >
        <Square className="size-4" />
        Stop All
      </button>
      <button
        type="button"
        onClick={onFadeAll}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
      >
        Fade All
      </button>
    </footer>
  )
}
