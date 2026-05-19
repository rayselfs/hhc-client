import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import NextItemPreview from './NextItemPreview'

export default function PresenterSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const nextItem = useMediaProjectionStore((s) => s.nextItem())
  const currentItem = useMediaProjectionStore((s) => s.currentItem())
  const updateNotes = useMediaProjectionStore((s) => s.updateNotes)

  const [notes, setNotes] = useState(currentItem?.notes ?? '')
  const [notesFontSize, setNotesFontSize] = useState(14)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setNotes(currentItem?.notes ?? '')
    })
    return () => cancelAnimationFrame(raf)
  }, [currentItem?.id, currentItem?.notes])

  const handleNotesChange = (value: string): void => {
    setNotes(value)
    if (currentItem) {
      updateNotes(currentItem.id, value)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black/50">
      <div className="shrink-0">
        <div className="text-white/50 text-xs uppercase tracking-wide px-3 pt-3 pb-1">
          {t('presenter.next')}
        </div>
        <div className="px-4 pb-4">
          <div className="relative aspect-video bg-black/50 rounded overflow-hidden border border-white/20">
            {nextItem === null && (
              <span className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                {t('presenter.endOfSlides')}
              </span>
            )}
            {nextItem && <NextItemPreview item={nextItem} />}
          </div>
          {nextItem && (
            <div className="text-white/70 text-xs mt-1 truncate text-center">{nextItem.name}</div>
          )}
        </div>
      </div>

      <GlassDivider />

      <div className="flex-1 relative overflow-hidden">
        <textarea
          className="absolute inset-0 bg-transparent text-white/90 p-3 pb-10 resize-none focus:outline-none placeholder:text-white/30"
          style={{ fontSize: `${notesFontSize}px` }}
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder={t('presenter.notesPlaceholder')}
        />
        <div className="absolute bottom-2 left-2 flex gap-1">
          <button
            className="text-white/50 hover:text-white/90 text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setNotesFontSize((s) => Math.min(s + 2, 28))}
          >
            A+
          </button>
          <button
            className="text-white/50 hover:text-white/90 text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setNotesFontSize((s) => Math.max(s - 2, 10))}
          >
            A-
          </button>
        </div>
      </div>
    </div>
  )
}
