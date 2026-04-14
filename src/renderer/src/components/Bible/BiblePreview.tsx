import { Button, Card, ScrollShadow, Spinner, Separator } from '@heroui/react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSearchStore } from '@renderer/stores/bible-search'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import {
  formatVerseReference,
  getBookConfig,
  buildVerseHistoryItem
} from '@renderer/lib/bible-utils'
import type { MouseEvent } from 'react'
import React, { useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const {
    currentPassage,
    getCurrentVerses,
    getCurrentBook,
    getCurrentChapter,
    nextChapter,
    prevChapter,
    navigateTo
  } = useBibleStore()

  const { claimProjection, project } = useProjection()
  const verseRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const isSearchMode = useBibleSearchStore((s) => s.isSearchMode)
  const isSearching = useBibleSearchStore((s) => s.isSearching)
  const isIndexReady = useBibleSearchStore((s) => s.isIndexReady)
  const searchResults = useBibleSearchStore((s) => s.results)
  const searchQuery = useBibleSearchStore((s) => s.query)
  const clearSearch = useBibleSearchStore((s) => s.clearSearch)

  const verses = getCurrentVerses()
  const book = getCurrentBook()
  const chapter = getCurrentChapter()

  const handleVerseClick = (verseIndex: number, verseNumber: number, verseText: string): void => {
    if (!book || !chapter) return
    const reference = formatVerseReference(t, book.number, chapter.number, verseNumber)
    claimProjection('bible', { unblank: true })
    project('bible:verse', { reference, text: verseText })
    navigateTo({ bookNumber: book.number, chapter: chapter.number, verse: verseNumber })
    onSelectedVerseIndexChange(verseIndex)

    const { selectedVersionId } = useBibleSettingsStore.getState()
    const { versions } = useBibleStore.getState()
    const versionMeta = versions.find((v) => v.id === selectedVersionId)
    const historyItem = buildVerseHistoryItem({
      bookNumber: book.number,
      bookName: book.name,
      chapter: chapter.number,
      verseNumber,
      text: verseText,
      versionCode: versionMeta?.code ?? '',
      versionName: versionMeta?.name ?? ''
    })
    useBibleHistoryStore.getState().addToHistory(historyItem)
  }

  const handleSearchResultClick = (bookNumber: number, chapterNum: number, verse: number): void => {
    navigateTo({ bookNumber, chapter: chapterNum, verse })
    clearSearch()
  }

  useEffect(() => {
    if (!verses || verses.length === 0) return
    const clamped = Math.max(0, Math.min(selectedVerseIndex, verses.length - 1))
    const verse = verses[clamped]
    if (!verse) return
    const el = verseRefs.current.get(verse.number)
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [selectedVerseIndex, verses])

  const revelation = getBookConfig(66)
  const isPrevDisabled = book?.number === 1 && chapter?.number === 1
  const isNextDisabled = book?.number === 66 && chapter?.number === revelation?.chapterCount

  const renderHighlightedText = (text: string, keyword: string): React.ReactNode => {
    if (!keyword.trim()) return text
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    let offset = 0
    return parts.map((part) => {
      const start = offset
      offset += part.length
      return part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={start} className="bg-warning/40 text-inherit rounded-sm">
          {part}
        </mark>
      ) : (
        <React.Fragment key={start}>{part}</React.Fragment>
      )
    })
  }

  const renderContent = (): React.JSX.Element => {
    if (!currentPassage) {
      return <div className="flex h-full items-center justify-center" />
    }

    if (isSearchMode) {
      if (isSearching || (!isIndexReady && searchQuery)) {
        return (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )
      }

      if (searchResults.length === 0) {
        return (
          <div className="flex h-full items-center justify-center">
            <p className="text-default-400">無結果</p>
          </div>
        )
      }

      return (
        <ScrollShadow hideScrollBar className="h-full">
          <div className="flex flex-col gap-1 p-4">
            {searchResults.map((r) => {
              const bookConfig = getBookConfig(r.bookNumber)
              const bookAbbr = bookConfig
                ? (t as (k: string) => string)(`bible.books.${bookConfig.code.toLowerCase()}.abbr`)
                : String(r.bookNumber)
              return (
                <button
                  key={r.verseId}
                  type="button"
                  onClick={() => handleSearchResultClick(r.bookNumber, r.chapter, r.verse)}
                  className="w-full text-left rounded-md p-2 hover:bg-default-100 transition-colors"
                >
                  <div className="text-xs font-medium text-primary mb-0.5">
                    {bookAbbr} {r.chapter}:{r.verse}
                  </div>
                  <div className="text-sm text-default-700">
                    {renderHighlightedText(r.text, searchQuery)}
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollShadow>
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
            const isProjected = currentPassage?.verse === verse.number
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
                className={`w-full text-left cursor-pointer rounded-md p-2 transition-colors flex items-start ${
                  isSelected
                    ? 'bg-primary/25 border-l-2 border-primary'
                    : isProjected
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'hover:bg-primary/10'
                }`}
              >
                <span className="text-default-400 mr-2 flex-shrink-0">{verse.number}</span>
                <span className="flex-1">{verse.text}</span>
              </button>
            )
          })}
          <div className="flex-shrink-0" style={{ height: '80%' }} aria-hidden />
        </div>
      </ScrollShadow>
    )
  }

  const bookName = book
    ? (t as (k: string) => string)(
        `bible.books.${getBookConfig(book.number)?.code.toLowerCase()}.name`
      )
    : ''

  return (
    <Card className="flex-1 h-full">
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-lg font-semibold">
          {bookName}
          {book && chapter
            ? ` ${chapter.number}${t(`bible.chapterUnit.${book.number === 19 ? 'psa' : 'default'}`)}`
            : ''}
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
