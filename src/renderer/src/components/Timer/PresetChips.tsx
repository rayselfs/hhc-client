import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Button } from '@heroui/react'
import { Plus, X } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'

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

  const handleAdd = () => {
    const name = window.prompt(t('timer.addPreset'))
    if (name && name.trim()) {
      addPreset(name.trim(), totalDuration)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Chip key={preset.id} className="cursor-pointer">
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
        <Button variant="ghost" onPress={handleAdd} aria-label={t('timer.addPreset')}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
