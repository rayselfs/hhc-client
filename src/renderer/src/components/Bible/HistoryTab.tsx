import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleStore } from '@renderer/stores/bible'
import type { VerseItem } from '@shared/types/folder'
import { ScrollShadow, Button } from '@heroui/react'
import { X } from 'lucide-react'

export function HistoryTab(): React.JSX.Element | null {
  const items = useBibleHistoryStore((state) => state.items)
  const removeFromHistory = useBibleHistoryStore((state) => state.removeFromHistory)
  const navigateTo = useBibleStore((state) => state.navigateTo)

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

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-default-400">尚無瀏覽歷史</div>
    )
  }

  return (
    <ScrollShadow className="h-full w-full" hideScrollBar>
      <div className="space-y-1 p-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="group flex w-full cursor-pointer items-center justify-between rounded-md p-2 text-left hover:bg-default-100 focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => handleNavigate(item)}
          >
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{getVerseReference(item)}</p>
              <p className="truncate text-xs text-default-500">
                {item.text.length > 60 ? `${item.text.substring(0, 60)}...` : item.text}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="invisible shrink-0 group-hover:visible"
              onPress={() => handleRemove(item.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <X size={16} />
            </Button>
          </button>
        ))}
      </div>
    </ScrollShadow>
  )
}
