import { useEffect, useState, useCallback, useRef } from 'react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { BiblePreview } from '@renderer/components/Control/Bible/BiblePreview'
import BibleMultiFunction from '@renderer/components/Control/Bible/BibleMultiFunction'
import { BibleSelectorDialog } from '@renderer/components/Control/Bible/BibleSelectorDialog'
import { useBibleContextMenu } from '@renderer/components/Control/Bible/useBibleContextMenu'
import type { VerseMenuData } from '@renderer/components/Control/Bible/useBibleContextMenu'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { EVENTS } from '@renderer/config/events'
import { buildVerseHistoryItem } from '@renderer/lib/bible-utils'
import type { BiblePassage } from '@shared/types/bible'

export default function BiblePage(): React.JSX.Element {
  const {
    getCurrentVerses,
    getCurrentBook,
    getCurrentChapter,
    navigateTo,
    nextChapter,
    prevChapter
  } = useBibleStore.getState()
  const { initialize: initializeFolderStore } = useBibleFolderStore()
  const fontSize = useBibleSettingsStore((s) => s.fontSize)
  const [isSelectorOpen, setSelectorOpen] = useState(false)
  const [selectedVerseIndex, setSelectedVerseIndex] = useState(0)
  const { showPreviewMenu } = useBibleContextMenu()
  const { claimProjection, project } = useProjection()

  const selectedVerseIndexRef = useRef(0)

  useEffect(() => {
    selectedVerseIndexRef.current = selectedVerseIndex
  })

  useEffect(() => {
    initializeFolderStore()
  }, [initializeFolderStore])

  useEffect(() => {
    project('bible:settings', { fontSize })
  }, [fontSize, project])

  useEffect(() => {
    const handler = (): void => setSelectorOpen(true)
    window.addEventListener(EVENTS.OPEN_BIBLE_SELECTOR, handler)
    return () => window.removeEventListener(EVENTS.OPEN_BIBLE_SELECTOR, handler)
  }, [])

  const bookNumber = useBibleStore((s) => s.currentPassage?.bookNumber)
  const chapterNumber = useBibleStore((s) => s.currentPassage?.chapter)
  const passageVerse = useBibleStore((s) => s.currentPassage?.verse)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (passageVerse && passageVerse > 1) {
        const verses = getCurrentVerses()
        const idx = verses ? verses.findIndex((v) => v.number === passageVerse) : -1
        setSelectedVerseIndex(idx >= 0 ? idx : 0)
      } else {
        setSelectedVerseIndex(0)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [bookNumber, chapterNumber, passageVerse, getCurrentVerses])

  const projectVerse = useCallback(
    (verseIndex: number, skipHistory = false) => {
      const verses = getCurrentVerses()
      if (!verses || verses.length === 0) return
      const clamped = Math.max(0, Math.min(verseIndex, verses.length - 1))
      const verse = verses[clamped]
      if (!verse) return

      const book = getCurrentBook()
      const chapter = getCurrentChapter()
      if (!book || !chapter) return

      claimProjection('bible', { unblank: true })
      project('bible:chapter', {
        bookNumber: book.number,
        chapter: chapter.number,
        chapterVerses: verses.map((v) => ({ number: v.number, text: v.text })),
        currentVerse: verse.number
      })
      navigateTo({ bookNumber: book.number, chapter: chapter.number, verse: verse.number })
      setSelectedVerseIndex(clamped)

      if (!skipHistory) {
        const { selectedVersionId } = useBibleSettingsStore.getState()
        const { versions } = useBibleStore.getState()
        const versionMeta = versions.find((v) => v.id === selectedVersionId)
        const historyItem = buildVerseHistoryItem({
          bookNumber: book.number,
          bookName: book.name,
          chapter: chapter.number,
          verseNumber: verse.number,
          text: verse.text,
          versionCode: versionMeta?.code ?? '',
          versionName: versionMeta?.name ?? ''
        })
        useBibleHistoryStore.getState().addToHistory(historyItem)
      }
    },
    [getCurrentVerses, getCurrentBook, getCurrentChapter, claimProjection, project, navigateTo]
  )

  const handleNextVerse = useCallback(() => {
    const verses = getCurrentVerses()
    if (!verses || verses.length === 0) return
    const next = Math.min(selectedVerseIndexRef.current + 1, verses.length - 1)
    projectVerse(next, true)
  }, [getCurrentVerses, projectVerse])

  const handlePrevVerse = useCallback(() => {
    const prev = Math.max(selectedVerseIndexRef.current - 1, 0)
    projectVerse(prev, true)
  }, [projectVerse])

  const handleNextChapter = useCallback(() => {
    nextChapter()
    projectVerse(0, true)
  }, [nextChapter, projectVerse])

  const handlePrevChapter = useCallback(() => {
    prevChapter()
    projectVerse(0, true)
  }, [prevChapter, projectVerse])

  const handleOpenSelector = useCallback(() => {
    setSelectorOpen(true)
  }, [])

  const handleCloseDialog = useCallback(() => {
    setSelectorOpen(false)
  }, [])

  const handleFocusSearch = useCallback(() => {
    const searchInput = document.querySelector<HTMLInputElement>('[data-bible-search]')
    searchInput?.focus()
  }, [])

  useKeyboardShortcuts(
    [
      {
        config: SHORTCUTS.BIBLE.PREV_VERSE,
        handler: handlePrevVerse,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.NEXT_VERSE,
        handler: handleNextVerse,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.NEXT_VERSE_ALT,
        handler: handleNextVerse,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.PREV_CHAPTER,
        handler: handlePrevChapter,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.NEXT_CHAPTER,
        handler: handleNextChapter,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.OPEN_SELECTOR,
        handler: handleOpenSelector,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.FOCUS_SEARCH,
        handler: handleFocusSearch,
        preventDefault: true
      },
      {
        config: SHORTCUTS.BIBLE.CLOSE_DIALOG,
        handler: handleCloseDialog,
        preventDefault: false
      }
    ],
    { enabled: true }
  )

  const handleSelectPassage = (passage: BiblePassage): void => {
    useBibleStore.getState().navigateTo(passage)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const verseNumber = Number(event.currentTarget.dataset.verseNumber)
    if (!verseNumber) return
    const verses = getCurrentVerses()
    const book = getCurrentBook()
    const chapter = getCurrentChapter()
    if (!verses || !book || !chapter) return
    const verse = verses.find((v) => v.number === verseNumber)
    if (!verse) return
    const menuData: VerseMenuData = {
      bookNumber: book.number,
      chapter: chapter.number,
      verse: verse.number,
      text: verse.text,
      bookName: book.name
    }
    showPreviewMenu(menuData, event)
  }

  return (
    <div data-testid="bible-page" className="flex flex-row gap-4 h-full">
      <BiblePreview
        onContextMenu={handleContextMenu}
        selectedVerseIndex={selectedVerseIndex}
        onSelectedVerseIndexChange={setSelectedVerseIndex}
      />
      <BibleMultiFunction />
      <BibleSelectorDialog
        isOpen={isSelectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleSelectPassage}
      />
    </div>
  )
}
