import { Button, ButtonGroup, Card, Spinner } from '@heroui/react'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSearchStore } from '@renderer/stores/bible-search'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import {
  getBookConfig,
  buildVerseHistoryItem,
  formatVerseReferenceShort
} from '@renderer/lib/bible-utils'
import { buildVerseItem } from './useBibleContextMenu'
import type { MouseEvent } from 'react'
import React, { useRef, useEffect, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, CirclePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface BiblePreviewProps {
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
  selectedVerseIndex: number
  onSelectedVerseIndexChange: (index: number) => void
  scrollBehaviorRef: RefObject<ScrollBehavior>
}

export function BiblePreview({
  onContextMenu,
  selectedVerseIndex,
  onSelectedVerseIndexChange,
  scrollBehaviorRef
}: BiblePreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const currentPassage = useBibleStore((s) => s.currentPassage)
  const {
    getCurrentVerses,
    getCurrentBook,
    getCurrentChapter,
    nextChapter,
    prevChapter,
    navigateTo
  } = useBibleStore.getState()

  const { claimProjection, project } = useProjection()
  const verseRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevSelectedVerseIndexRef = useRef<number>(selectedVerseIndex)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [spacerHeight, setSpacerHeight] = useState(0)
  const handleQuickAddToFolder = (
    verseNumber: number,
    verseText: string,
    e: React.MouseEvent
  ): void => {
    e.stopPropagation()
    if (!book || !chapter) return
    const item = buildVerseItem({
      bookNumber: book.number,
      chapter: chapter.number,
      verse: verseNumber,
      text: verseText
    })
    useBibleFolderStore.getState().addItem(item)
  }

  const scrollContainerCallbackRef = (node: HTMLDivElement | null): void => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = null
    }
    scrollContainerRef.current = node
    if (!node) return
    setSpacerHeight(node.clientHeight)
    const observer = new ResizeObserver(() => {
      setSpacerHeight(node.clientHeight)
    })
    observer.observe(node)
    resizeObserverRef.current = observer
  }

  const isSearchMode = useBibleSearchStore((s) => s.isSearchMode)
  const isSearching = useBibleSearchStore((s) => s.isSearching)
  const isIndexReady = useBibleSearchStore((s) => s.isIndexReady)
  const searchResults = useBibleSearchStore((s) => s.results)
  const searchQuery = useBibleSearchStore((s) => s.query)

  const verses = getCurrentVerses()
  const book = getCurrentBook()
  const chapter = getCurrentChapter()

  const handleVerseClick = (verseIndex: number, verseNumber: number, _verseText: string): void => {
    if (!book || !chapter) return
    claimProjection('bible', { unblank: true })
    project('bible:chapter', {
      bookNumber: book.number,
      chapter: chapter.number,
      chapterVerses: verses.map((v) => ({ number: v.number, text: v.text })),
      currentVerse: verseNumber
    })
    navigateTo({ bookNumber: book.number, chapter: chapter.number, verse: verseNumber })
    scrollBehaviorRef.current = 'smooth'
    onSelectedVerseIndexChange(verseIndex)

    const { selectedVersionId } = useBibleSettingsStore.getState()
    const historyItem = buildVerseHistoryItem({
      versionId: selectedVersionId,
      bookNumber: book.number,
      chapter: chapter.number,
      verseNumber,
      text: _verseText
    })
    useBibleHistoryStore.getState().addToHistory(historyItem)
  }

  const handleSearchResultClick = (bookNumber: number, chapterNum: number, verse: number): void => {
    navigateTo({ bookNumber, chapter: chapterNum, verse })
  }

  useEffect(() => {
    if (!verses || verses.length === 0) return
    const clamped = Math.max(0, Math.min(selectedVerseIndex, verses.length - 1))
    const verse = verses[clamped]
    if (!verse) return
    const el = verseRefs.current.get(verse.number)
    const container = scrollContainerRef.current
    if (el && container && typeof container.scrollTo === 'function') {
      const top =
        el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
      const behavior = scrollBehaviorRef.current
      container.scrollTo({ top, behavior })
    }
    scrollBehaviorRef.current = 'smooth'
    prevSelectedVerseIndexRef.current = selectedVerseIndex
  }, [selectedVerseIndex, verses, scrollBehaviorRef])

  const searchResultsLength = searchResults.length
  useEffect(() => {
    if (!isSearchMode || searchResultsLength === 0) return
    const id = requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(id)
  }, [isSearchMode, searchResultsLength])

  const revelation = getBookConfig(66)
  const isPrevDisabled = book?.number === 1 && chapter?.number === 1
  const isNextDisabled = book?.number === 66 && chapter?.number === revelation?.chapterCount

  const renderHighlightedText = (text: string, keyword: string): React.ReactNode => {
    if (!keyword.trim()) return text
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    let charOffset = 0
    return parts.map((part) => {
      const key = `${charOffset}:${part.length}`
      charOffset += part.length
      return part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={key} className="bg-danger/40 text-inherit rounded-sm">
          {part}
        </mark>
      ) : (
        <React.Fragment key={key}>{part}</React.Fragment>
      )
    })
  }

  const renderContent = (): React.JSX.Element => {
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
            <p className="text-muted">{t('bible.search.noResults')}</p>
          </div>
        )
      }

      return (
        <div ref={scrollContainerRef} className="h-full overflow-y-auto">
          <div className="flex flex-col gap-2 p-2 pt-0">
            {searchResults.map((r) => {
              const reference = formatVerseReferenceShort(t, r.bookNumber, r.chapter, r.verse)
              return (
                <button
                  key={r.verseId}
                  type="button"
                  onClick={() => handleSearchResultClick(r.bookNumber, r.chapter, r.verse)}
                  className="w-full text-left rounded-3xl p-3 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="text-sm font-medium text-muted mb-1">{reference}</div>
                  <div className="text-xl text-foreground">
                    {renderHighlightedText(r.text, searchQuery)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (!currentPassage || !verses || verses.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted">{t('bible.preview.noContent')}</p>
        </div>
      )
    }

    return (
      <div ref={scrollContainerCallbackRef} className="h-full overflow-y-auto">
        <div className="flex flex-col gap-2 p-2 pt-0">
          {verses.map((verse, index) => {
            const isSelected = index === selectedVerseIndex
            const isProjected = currentPassage?.verse === verse.number
            return (
              <div key={verse.number} className="group relative">
                <button
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
                  className={`w-full text-left rounded-3xl p-3 transition-colors flex items-start ${
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : isProjected
                        ? 'bg-accent-soft'
                        : 'hover:opacity-70'
                  }`}
                >
                  <span
                    className={`mr-2 shrink-0 ${isSelected ? '' : 'text-muted group-hover:text-inherit'}`}
                  >
                    {verse.number}
                  </span>
                  <span className="flex-1 text-xl pr-6">{verse.text}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleQuickAddToFolder(verse.number, verse.text, e)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-transparent!"
                  aria-label={t('bible.contextMenu.addToFolder')}
                >
                  <CirclePlus size={14} className="text-muted" />
                </Button>
              </div>
            )
          })}
          <div className="shrink-0" style={{ height: spacerHeight }} aria-hidden />
        </div>
      </div>
    )
  }

  const bookName = book
    ? (t as (k: string) => string)(
        `bible.books.${getBookConfig(book.number)?.code.toLowerCase()}.name`
      )
    : ''

  const chapterUnitKey = book?.number === 19 ? 'psa' : 'default'
  const chapterUnit = book && chapter ? t(`bible.chapterUnit.${chapterUnitKey}`) : ''
  const chapterSuffix =
    book && chapter ? ` ${chapter.number}${chapterUnit === ':' ? '' : chapterUnit}` : ''

  return (
    <Card className="flex flex-col h-full flex-1 p-0 gap-2">
      <Card.Header className="shrink-0 flex-row! items-center justify-between p-0 pt-2">
        <h2 className="text-lg pl-5">
          {isSearchMode ? t('bible.search.title') : `${bookName}${chapterSuffix}`}
        </h2>
        {!isSearchMode && (
          <ButtonGroup size="lg" className="pr-2">
            <Button
              isIconOnly
              variant="outline"
              className="bg-default/40 hover:bg-default/80"
              onPress={prevChapter}
              isDisabled={isPrevDisabled}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              isIconOnly
              variant="outline"
              className="bg-default/40 hover:bg-default/80"
              onPress={nextChapter}
              isDisabled={isNextDisabled}
            >
              <ChevronRight size={16} />
            </Button>
          </ButtonGroup>
        )}
      </Card.Header>
      <GlassDivider />
      <Card.Content className="flex-1 min-h-0 overflow-hidden p-0">{renderContent()}</Card.Content>
    </Card>
  )
}
