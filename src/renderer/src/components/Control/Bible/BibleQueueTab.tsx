import { Button } from '@heroui/react/button'
import { ScrollShadow } from '@heroui/react/scroll-shadow'
import { Play, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { projectBibleQueueItem } from '@renderer/lib/bible-queue-projection'
import { useBibleLiveQueueStore } from '@renderer/stores/bible-live-queue'

interface BibleQueueTabProps {
  onProjected?: (passage: { bookNumber: number; chapter: number; verse: number }) => void
}

export function BibleQueueTab({ onProjected }: BibleQueueTabProps): React.JSX.Element {
  const { t } = useTranslation()
  const items = useBibleLiveQueueStore((state) => state.items)
  const currentItemId = useBibleLiveQueueStore((state) => state.currentItemId)
  const removeItem = useBibleLiveQueueStore((state) => state.removeItem)
  const clear = useBibleLiveQueueStore((state) => state.clear)
  const { startProjection } = useProjection()
  const currentIndex = items.findIndex((item) => item.id === currentItemId)

  const handleProject = async (id: string): Promise<void> => {
    const item = useBibleLiveQueueStore.getState().items.find((candidate) => candidate.id === id)
    if (!item) return
    const projected = await projectBibleQueueItem(item, { startProjection })
    if (!projected) return
    useBibleLiveQueueStore.getState().setCurrentItem(id)
    onProjected?.({
      bookNumber: item.bookNumber,
      chapter: item.chapter,
      verse: item.verse
    })
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        {t('bible.queue.empty')}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="text-sm text-muted">{t('bible.queue.description')}</div>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={clear}
          aria-label={t('bible.queue.clear')}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <ScrollShadow className="min-h-0 flex-1" hideScrollBar>
        <div className="flex flex-col gap-2 p-2 pt-0">
          {items.map((item, index) => {
            const isCurrent = item.id === currentItemId
            const isNext = currentIndex >= 0 && !isCurrent && index === currentIndex + 1
            return (
              <div
                key={item.id}
                className={[
                  'group flex items-center gap-2 rounded-lg p-3 transition-colors',
                  isCurrent ? 'bg-accent text-accent-foreground' : 'hover:bg-accent-soft'
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  onClick={() => void handleProject(item.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      isCurrent ? 'text-accent-foreground/80 dark:text-muted' : 'text-muted'
                    }`}
                  >
                    <span>{item.reference}</span>
                    {isCurrent && <span>{t('bible.queue.current')}</span>}
                    {isNext && <span>{t('bible.queue.next')}</span>}
                  </div>
                  <div className="line-clamp-2 text-lg">{item.text}</div>
                </button>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => void handleProject(item.id)}
                  aria-label={t('bible.queue.project')}
                >
                  <Play size={16} />
                </Button>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => removeItem(item.id)}
                  aria-label={t('bible.queue.remove')}
                >
                  <X size={16} />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollShadow>
    </div>
  )
}
