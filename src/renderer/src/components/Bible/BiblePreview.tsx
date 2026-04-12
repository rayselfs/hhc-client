import { Button, Card, ScrollShadow, Spinner, Separator } from '@heroui/react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { BIBLE_BOOKS, formatVerseReference } from '@shared/types/bible'
import type { MouseEvent } from 'react'
import { useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BiblePreviewProps {
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
  selectedVerseIndex: number
  onSelectedVerseIndexChange: (index: number) => void
}

export function BiblePreview({
  onContextMenu,
  selectedVerseIndex,
  onSelectedVerseIndexChange
}: BiblePreviewProps): React.JSX.Element {
  const {
    isLoading,
    error,
    retry,
    currentPassage,
    getCurrentVerses,
    getCurrentBook,
    getCurrentChapter,
    nextChapter,
    prevChapter,
    navigateTo
  } = useBibleStore()

  const { fontSize } = useBibleSettingsStore()
  const { claimProjection, project } = useProjection()
  const verseRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const verses = getCurrentVerses()
  const book = getCurrentBook()
  const chapter = getCurrentChapter()

  const handleVerseClick = (verseIndex: number, verseNumber: number, verseText: string): void => {
    if (!book || !chapter) return
    const reference = formatVerseReference(book.name, book.number, chapter.number, verseNumber)
    claimProjection('bible', { unblank: true })
    project('bible:verse', { reference, text: verseText, fontSize })
    navigateTo({ bookNumber: book.number, chapter: chapter.number, verse: verseNumber })
    onSelectedVerseIndexChange(verseIndex)
  }

  useEffect(() => {
    if (!verses || verses.length === 0) return
    const clamped = Math.max(0, Math.min(selectedVerseIndex, verses.length - 1))
    const verse = verses[clamped]
    if (!verse) return
    const el = verseRefs.current.get(verse.number)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedVerseIndex, verses])

  const revelation = BIBLE_BOOKS.find((b) => b.number === 66)
  const isPrevDisabled = book?.number === 1 && chapter?.number === 1
  const isNextDisabled = book?.number === 66 && chapter?.number === revelation?.chapterCount

  const renderContent = (): React.JSX.Element => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p>{error}</p>
          <Button onPress={retry}>重試</Button>
        </div>
      )
    }

    if (!verses || verses.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-default-500">尚未載入經文內容</p>
        </div>
      )
    }

    return (
      <ScrollShadow hideScrollBar className="h-full">
        <div className="flex flex-col gap-2 p-4">
          {verses.map((verse, index) => {
            const isSelected = index === selectedVerseIndex
            const isProjected = currentPassage.verse === verse.number
            return (
              <button
                key={verse.number}
                ref={(el) => {
                  if (el) {
                    verseRefs.current.set(verse.number, el)
                  } else {
                    verseRefs.current.delete(verse.number)
                  }
                }}
                type="button"
                onClick={() => handleVerseClick(index, verse.number, verse.text)}
                onContextMenu={onContextMenu}
                data-verse-number={verse.number}
                className={`w-full text-left cursor-pointer rounded-md p-2 transition-colors ${
                  isSelected
                    ? 'bg-primary/20 border-l-2 border-primary ring-1 ring-primary/30'
                    : isProjected
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'hover:bg-default-100'
                }`}
              >
                <span className="text-default-400 mr-2">{verse.number}</span>
                <span>{verse.text}</span>
              </button>
            )
          })}
        </div>
      </ScrollShadow>
    )
  }

  return (
    <Card className="flex-1 h-full">
      <div className="flex flex-row items-center justify-between p-4">
        <h2 className="text-lg font-semibold">
          {book?.name ?? ''}
          {book && chapter ? ` 第 ${chapter.number} 章` : ''}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={prevChapter}
            isDisabled={isPrevDisabled}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={nextChapter}
            isDisabled={isNextDisabled}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <Separator />
      <Card.Content className="p-0">{renderContent()}</Card.Content>
    </Card>
  )
}
