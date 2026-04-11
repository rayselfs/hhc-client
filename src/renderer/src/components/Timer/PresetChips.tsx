import { useTranslation } from 'react-i18next'
import { Chip, Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'

function formatDurationLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface PresetChipsProps {
  className?: string
}

export default function PresetChips({ className }: PresetChipsProps): React.JSX.Element {
  const { t } = useTranslation()
  const presets = useTimerStore((s) => s.presets)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const status = useTimerStore((s) => s.status)
  const applyPreset = useTimerStore((s) => s.applyPreset)
  const removePreset = useTimerStore((s) => s.removePreset)
  const addPreset = useTimerStore((s) => s.addPreset)

  const isRunning = status !== 'stopped'
  const hasDuplicate = presets.some((p) => p.durationSeconds === totalDuration)

  const handleAdd = (): void => {
    if (hasDuplicate) return
    const name = formatDurationLabel(totalDuration)
    addPreset(name, totalDuration)
  }

  const handleContextMenu = (e: React.MouseEvent, presetId: string): void => {
    e.preventDefault()
    if (isRunning) return
    removePreset(presetId)
  }

  return (
    <div className={className}>
      <div className="flex flex-col items-stretch gap-2">
        {presets.map((preset) => (
          <Chip
            key={preset.id}
            size="lg"
            className={[
              'text-base px-4 py-2 transition-colors',
              isRunning
                ? 'opacity-50 pointer-events-none'
                : 'cursor-pointer hover:bg-default-200 active:bg-default-300'
            ].join(' ')}
            onContextMenu={(e) => handleContextMenu(e, preset.id)}
          >
            <span
              role="button"
              tabIndex={isRunning ? -1 : 0}
              aria-label={preset.name}
              aria-disabled={isRunning}
              onKeyDown={(e) => {
                if (!isRunning && (e.key === 'Enter' || e.key === ' ')) applyPreset(preset.id)
              }}
              onClick={() => !isRunning && applyPreset(preset.id)}
            >
              {preset.name}
            </span>
          </Chip>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="text-base h-auto py-1 rounded-full w-full"
          onPress={handleAdd}
          isDisabled={isRunning || hasDuplicate}
          aria-label={t('timer.addPreset')}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
