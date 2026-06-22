import { useSoundboardStore } from '@renderer/stores/soundboard'

interface SoundboardGridProps {
  onTriggerPad: (padId: string) => void
  onReleasePad: (padId: string) => void
}

export default function SoundboardGrid({
  onTriggerPad,
  onReleasePad
}: SoundboardGridProps): React.JSX.Element {
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const selectedPadId = useSoundboardStore((state) => state.selectedPadId)
  const selectPad = useSoundboardStore((state) => state.selectPad)
  const live = useSoundboardStore((state) => state.live)

  if (!scene) return <div className="p-4 text-sm text-muted">No scene</div>

  return (
    <section className="grid min-h-0 flex-1 grid-cols-8 gap-2 p-3" aria-label="Soundboard pads">
      {scene.padOrder.map((padId) => {
        const pad = scene.pads[padId]
        const status = live[padId]?.status ?? 'idle'
        const active = selectedPadId === padId
        const label = pad.label || pad.asset?.name || 'Empty pad'

        return (
          <button
            key={pad.id}
            type="button"
            aria-label={label}
            aria-pressed={status === 'playing'}
            onClick={() => {
              selectPad(pad.id)
              onTriggerPad(pad.id)
            }}
            onPointerUp={() => onReleasePad(pad.id)}
            className={`min-h-16 rounded-lg border p-2 text-left text-xs font-semibold text-white shadow-sm transition ${
              active ? 'border-white ring-2 ring-white/70' : 'border-white/10'
            }`}
            style={{ backgroundColor: pad.asset ? pad.color : '#27272a' }}
          >
            <span className="line-clamp-2 break-words">{label}</span>
            <span className="mt-2 block text-[10px] uppercase opacity-75">{status}</span>
          </button>
        )
      })}
    </section>
  )
}
