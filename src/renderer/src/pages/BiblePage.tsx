import { useEffect, useState, useCallback, useRef } from 'react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { BiblePreview } from '@renderer/components/Bible/BiblePreview'
import BibleMultiFunction from '@renderer/components/Bible/BibleMultiFunction'
import { BibleSelectorDialog } from '@renderer/components/Bible/BibleSelectorDialog'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { formatVerseReference } from '@shared/types/bible'
import type { BiblePassage } from '@shared/types/bible'
import { toast } from '@heroui/react'

export default function BiblePage(): React.JSX.Element {
  const {
    isInitialized,
    initialize,
    getCurrentVerses,
    getCurrentBook,
    getCurrentChapter,
    navigateTo,
    nextChapter,
    prevChapter
  } = useBibleStore()
  const { isLoading, initialize: initializeFolderStore } = useBibleFolderStore()
  const { fontSize } = useBibleSettingsStore()
  const [isSelectorOpen, setSelectorOpen] = useState(false)
  const [selectedVerseIndex, setSelectedVerseIndex] = useState(0)
  const { showMenu } = useContextMenu()
  const { claimProjection, project } = useProjection()

  const selectedVerseIndexRef = useRef(0)

  useEffect(() => {
    selectedVerseIndexRef.current = selectedVerseIndex
  })

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
    if (!isLoading) {
      initializeFolderStore()
    }
  }, [isInitialized, initialize, isLoading, initializeFolderStore])

  useEffect(() => {
    const handler = (): void => setSelectorOpen(true)
    window.addEventListener('open-bible-selector', handler)
    return () => window.removeEventListener('open-bible-selector', handler)
  }, [])

  const bookNumber = useBibleStore((s) => s.currentPassage.bookNumber)
  const chapterNumber = useBibleStore((s) => s.currentPassage.chapter)
  useEffect(() => {
    const id = requestAnimationFrame(() => setSelectedVerseIndex(0))
    return () => cancelAnimationFrame(id)
  }, [bookNumber, chapterNumber])

  const projectVerse = useCallback(
    (verseIndex: number) => {
      const verses = getCurrentVerses()
      if (!verses || verses.length === 0) return
      const clamped = Math.max(0, Math.min(verseIndex, verses.length - 1))
      const verse = verses[clamped]
      if (!verse) return

      const book = getCurrentBook()
      const chapter = getCurrentChapter()
      if (!book || !chapter) return

      const reference = formatVerseReference(book.name, book.number, chapter.number, verse.number)
      claimProjection('bible', { unblank: true })
      project('bible:verse', { reference, text: verse.text, fontSize })
      navigateTo({ bookNumber: book.number, chapter: chapter.number, verse: verse.number })
      setSelectedVerseIndex(clamped)
    },
    [
      getCurrentVerses,
      getCurrentBook,
      getCurrentChapter,
      claimProjection,
      project,
      fontSize,
      navigateTo
    ]
  )

  const handleNextVerse = useCallback(() => {
    const verses = getCurrentVerses()
    if (!verses || verses.length === 0) return
    const next = Math.min(selectedVerseIndexRef.current + 1, verses.length - 1)
    projectVerse(next)
  }, [getCurrentVerses, projectVerse])

  const handlePrevVerse = useCallback(() => {
    const prev = Math.max(selectedVerseIndexRef.current - 1, 0)
    projectVerse(prev)
  }, [projectVerse])

  const handleNextChapter = useCallback(() => {
    nextChapter()
  }, [nextChapter])

  const handlePrevChapter = useCallback(() => {
    prevChapter()
  }, [prevChapter])

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
    const verseNumber = event.currentTarget.dataset.verseNumber
    if (!verseNumber) return

    showMenu(
      [
        {
          id: 'copy',
          label: '複製經文',
          onAction: () => {
            // TODO: Implement copy
            toast.success('Copied')
          }
        },
        {
          id: 'add-to-folder',
          label: '添加到自訂資料夾',
          onAction: () => {
            // TODO: Implement add to folder
            toast.success('Added to folder')
          }
        }
      ],
      event
    )
  }

  return (
    <div data-testid="bible-page" className="flex flex-row gap-4 h-full p-4">
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
