import { useSoundboardStore } from '@renderer/stores/soundboard'
import type { SoundboardTriggerMode } from '@renderer/types/soundboard'

const TRIGGER_MODES: SoundboardTriggerMode[] = ['one-shot', 'toggle', 'hold']

export default function SoundboardInspector(): React.JSX.Element {
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const selectedPadId = useSoundboardStore((state) => state.selectedPadId)
  const updatePad = useSoundboardStore((state) => state.updatePad)
  const clearPadAsset = useSoundboardStore((state) => state.clearPadAsset)
  const pad = selectedPadId ? scene?.pads[selectedPadId] : null

  if (!pad) {
    return (
      <aside className="w-72 shrink-0 border-l border-border p-3 text-sm text-muted">
        Select a pad
      </aside>
    )
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 border-l border-border bg-surface-secondary p-3">
      <label className="grid gap-1 text-xs font-medium">
        Label
        <input
          aria-label="Label"
          value={pad.label}
          onChange={(event) => updatePad(pad.id, { label: event.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Trigger mode
        <select
          aria-label="Trigger mode"
          value={pad.triggerMode}
          onChange={(event) =>
            updatePad(pad.id, { triggerMode: event.target.value as SoundboardTriggerMode })
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {TRIGGER_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={pad.loop}
          onChange={(event) => updatePad(pad.id, { loop: event.target.checked })}
        />
        Loop
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Volume
        <input
          aria-label="Volume"
          type="number"
          min={0}
          max={100}
          value={Math.round(pad.volume * 100)}
          onChange={(event) => updatePad(pad.id, { volume: Number(event.target.value) / 100 })}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Color
        <input
          aria-label="Color"
          type="color"
          value={pad.color}
          onChange={(event) => updatePad(pad.id, { color: event.target.value })}
          className="h-9 rounded-md border border-border bg-background"
        />
      </label>
      <div className="rounded-md border border-border p-2 text-xs">
        <div className="font-medium">Asset</div>
        <div className="mt-1 truncate text-muted">{pad.asset?.name ?? 'No audio assigned'}</div>
        {pad.asset && (
          <button type="button" className="mt-2 text-danger" onClick={() => clearPadAsset(pad.id)}>
            Clear
          </button>
        )}
      </div>
    </aside>
  )
}
