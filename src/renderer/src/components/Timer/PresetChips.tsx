import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Button } from '@heroui/react'
import { Plus, X } from 'lucide-react'
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
  const applyPreset = useTimerStore((s) => s.applyPreset)
  const removePreset = useTimerStore((s) => s.removePreset)
  const addPreset = useTimerStore((s) => s.addPreset)
  const loadPresets = useTimerStore((s) => s.loadPresets)

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  const hasDuplicate = presets.some((p) => p.durationSeconds === totalDuration)

  const handleAdd = (): void => {
    if (hasDuplicate) return
    const name = formatDurationLabel(totalDuration)
    addPreset(name, totalDuration)
  }

  return (
    <div className={className}>
      <h3 className="text-base font-medium mb-2">{t('timer.timerPresets')}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Chip key={preset.id} size="lg" className="cursor-pointer text-base px-4 py-2">
            <span
              role="button"
              tabIndex={0}
              aria-label={preset.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') applyPreset(preset.id)
              }}
              onClick={() => applyPreset(preset.id)}
              className="pr-1"
            >
              {preset.name}
            </span>
            <button
              type="button"
              aria-label={`${t('timer.deletePreset')} ${preset.name}`}
              onClick={(e) => {
                e.stopPropagation()
                removePreset(preset.id)
              }}
              className="ml-1 inline-flex items-center justify-center rounded-full hover:opacity-70"
            >
              <X className="size-3" />
            </button>
          </Chip>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="text-base px-4 h-auto py-2 rounded-full"
          onPress={handleAdd}
          isDisabled={hasDuplicate}
          aria-label={t('timer.addPreset')}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
