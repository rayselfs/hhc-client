import { useTranslation } from 'react-i18next'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export default function PresenterNavigation() {
  const { t } = useTranslation()
  const canNext = useMediaProjectionStore((s) => s.canNext())
  const canPrev = useMediaProjectionStore((s) => s.canPrev())
  const progress = useMediaProjectionStore((s) => s.progress())
  const next = useMediaProjectionStore((s) => s.next)
  const prev = useMediaProjectionStore((s) => s.prev)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
      <button
        className="text-white/70 hover:text-white disabled:text-white/20 disabled:cursor-not-allowed px-3 py-1 rounded text-sm"
        onClick={() => prev()}
        disabled={!canPrev}
      >
        ← {t('presenter.prev')}
      </button>

      <span className="text-white/70 text-sm font-mono">{progress}</span>

      <button
        className="text-white/70 hover:text-white disabled:text-white/20 disabled:cursor-not-allowed px-3 py-1 rounded text-sm"
        onClick={() => next()}
        disabled={!canNext}
      >
        {t('presenter.next')} →
      </button>
    </div>
  )
}
