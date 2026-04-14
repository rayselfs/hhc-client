import { useEffect, useMemo } from 'react'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleStore } from '@renderer/stores/bible'
import type { VerseItem } from '@shared/types/folder'
import { ScrollShadow, Button } from '@heroui/react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function isSameDay(ts: number, date: Date): boolean {
  const d = new Date(ts)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

export function HistoryTab(): React.JSX.Element | null {
  const { t } = useTranslation()
  const items = useBibleHistoryStore((state) => state.items)
  const removeFromHistory = useBibleHistoryStore((state) => state.removeFromHistory)
  const navigateTo = useBibleStore((state) => state.navigateTo)

  useEffect(() => {
    const today = new Date()
    const { items: currentItems, removeFromHistory: remove } = useBibleHistoryStore.getState()
    const stale = currentItems.filter((item) => !isSameDay(item.createdAt, today))
    stale.forEach((item) => {
      remove(item.id)
    })
  }, [])

  const todayItems = useMemo(() => {
    const today = new Date()
    return items.filter((item) => isSameDay(item.createdAt, today))
  }, [items])

  const handleNavigate = (item: VerseItem): void => {
    navigateTo({
      bookNumber: item.bookNumber,
      chapter: item.chapter,
      verse: item.verseStart
    })
  }

  const handleRemove = (id: string): void => {
    removeFromHistory(id)
  }

  const getVerseReference = (item: VerseItem): string => {
    if (item.verseStart === item.verseEnd) {
      return `${item.bookName} ${item.chapter}:${item.verseStart}`
    }
    return `${item.bookName} ${item.chapter}:${item.verseStart}-${item.verseEnd}`
  }

  if (todayItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        {t('bible.history.emptyMessage', '尚無瀏覽歷史')}
      </div>
    )
  }

  return (
    <ScrollShadow className="h-full w-full" hideScrollBar>
      <div className="flex flex-col gap-1 p-2">
        {todayItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center group rounded-3xl transition-colors hover:bg-accent/8"
          >
            <button
              type="button"
              onClick={() => handleNavigate(item)}
              className="flex-1 min-w-0 text-left cursor-pointer p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl"
            >
              <p className="truncate text-sm font-medium text-muted">{getVerseReference(item)}</p>
              <p className="text-base text-foreground whitespace-normal">
                {item.text.length > 60 ? `${item.text.substring(0, 60)}...` : item.text}
              </p>
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="invisible shrink-0 mr-2 group-hover:visible"
              onPress={() => handleRemove(item.id)}
            >
              <X size={16} />
            </Button>
          </div>
        ))}
      </div>
    </ScrollShadow>
  )
}
