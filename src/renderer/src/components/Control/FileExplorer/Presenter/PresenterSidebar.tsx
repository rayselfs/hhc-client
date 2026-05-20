import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import NextItemPreview from './Preview/NextItemPreview'

export default function PresenterSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const nextItem = useMediaProjectionStore((s) => s.nextItem())
  const currentItem = useMediaProjectionStore((s) => s.currentItem())
  const updateNotes = useMediaProjectionStore((s) => s.updateNotes)

  const [notes, setNotes] = useState(currentItem?.notes ?? '')
  const [notesFontSize, setNotesFontSize] = useState(
    () => parseInt(localStorage.getItem('hhc-notes-font-size') ?? '14', 10)
  )

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
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0">
        <div className="h-12 flex items-center px-3 text-foreground/60 text-base font-medium">
          {t('presenter.next')}
        </div>
        <div className="px-4 pb-4">
          <div
            className="relative aspect-video bg-surface-secondary rounded-2xl overflow-hidden shadow-xl cursor-default"
            onClick={() => useMediaProjectionStore.getState().next()}
          >
            {nextItem === null && (
              <span className="absolute inset-0 flex items-center justify-center text-foreground/50 text-base">
                {t('presenter.endOfSlides')}
              </span>
            )}
            {nextItem && <NextItemPreview item={nextItem} />}
            {nextItem && (
              <div className="absolute bottom-1 inset-x-0 flex justify-center px-3 pointer-events-none">
                <span
                  className="text-foreground/90 text-sm truncate"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }}
                >
                  {nextItem.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <GlassDivider />

      <div className="flex-1 relative overflow-hidden">
        <textarea
          className="absolute inset-0 bg-transparent text-foreground/90 p-3 pb-10 resize-none focus:outline-none placeholder:text-foreground/30"
          style={{ fontSize: `${notesFontSize}px` }}
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
              e.currentTarget.blur()
            }
          }}
          placeholder={t('presenter.notesPlaceholder')}
        />
        <div className="absolute bottom-2 left-2 flex gap-1">
          <Button
            isIconOnly
            variant="ghost"
            size="lg"
            onPress={() =>
              setNotesFontSize((s) => {
                const v = Math.min(s + 2, 28)
                localStorage.setItem('hhc-notes-font-size', String(v))
                return v
              })
            }
            aria-label="Increase font size"
          >
            A+
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            size="lg"
            onPress={() =>
              setNotesFontSize((s) => {
                const v = Math.max(s - 2, 10)
                localStorage.setItem('hhc-notes-font-size', String(v))
                return v
              })
            }
            aria-label="Decrease font size"
          >
            A-
          </Button>
        </div>
      </div>
    </div>
  )
}
