import { useEffect, useMemo, useRef } from 'react'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { formatVerseReferenceShort } from '@renderer/lib/bible-utils'
import type { VerseItem } from '@shared/types/folder'
import { ScrollShadow } from '@heroui/react/scroll-shadow'
import { Button } from '@heroui/react/button'
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
  const versions = useBibleStore((state) => state.versions)

  const scrollRef = useRef<HTMLDivElement>(null)

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
    const { selectedVersionId, setSelectedVersionId } = useBibleSettingsStore.getState()
    const { versions } = useBibleStore.getState()
    const targetVersionId =
      item.versionId && versions.some((v) => v.id === item.versionId)
        ? item.versionId
        : selectedVersionId
    if (targetVersionId !== selectedVersionId) {
      setSelectedVersionId(targetVersionId)
    }
    navigateTo({
      bookNumber: item.bookNumber,
      chapter: item.chapter,
      verse: item.verse
    })
  }

  const handleRemove = (id: string): void => {
    removeFromHistory(id)
  }

  const getVerseReference = (item: VerseItem): string => {
    return formatVerseReferenceShort(t, item.bookNumber, item.chapter, item.verse)
  }

  const todayItemsLength = todayItems.length
  useEffect(() => {
    if (todayItemsLength === 0) return
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(id)
  }, [todayItemsLength])

  if (todayItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        {t('bible.history.emptyMessage', '尚無瀏覽歷史')}
      </div>
    )
  }

  return (
    <ScrollShadow ref={scrollRef} className="h-full w-full" hideScrollBar>
      <div className="flex flex-col gap-2 p-2 pt-0">
        {todayItems.map((item) => {
          const versionLocale = versions.find((v) => v.id === item.versionId)?.locale
          return (
            <div
              key={item.id}
              className="flex items-center group rounded-3xl transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <button
                type="button"
                onClick={() => handleNavigate(item)}
                className="flex-1 min-w-0 text-left p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl"
              >
                <p className="truncate text-muted group-hover:text-accent-foreground/80 dark:group-hover:text-muted">
                  {getVerseReference(item)}
                </p>
                <p
                  lang={versionLocale}
                  className="text-lg text-foreground group-hover:text-accent-foreground line-clamp-2 max-lg:line-clamp-1"
                >
                  {item.text}
                </p>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="invisible shrink-0 mr-2 group-hover:visible cursor-pointer hover:bg-transparent!"
                onPress={() => handleRemove(item.id)}
              >
                <X size={16} />
              </Button>
            </div>
          )
        })}
      </div>
    </ScrollShadow>
  )
}
