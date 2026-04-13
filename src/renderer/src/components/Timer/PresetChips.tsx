import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
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
      <div className="flex flex-col items-stretch gap-3 w-18">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            size="lg"
            variant="tertiary"
            isDisabled={isRunning}
            className="rounded-full w-19"
            aria-label={preset.name}
            onPress={() => !isRunning && applyPreset(preset.id)}
            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, preset.id)}
          >
            {preset.name}
          </Button>
        ))}
        <Button
          size="lg"
          variant="outline"
          className="rounded-full w-19"
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
