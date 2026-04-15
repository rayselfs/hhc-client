import { useState, useEffect, useMemo, useCallback } from 'react'
import { Modal, Button, Tabs, Breadcrumbs, Input, ScrollShadow } from '@heroui/react'
import { BIBLE_BOOKS } from '@shared/types/bible'
import type { BiblePassage } from '@shared/types/bible'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useTranslation } from 'react-i18next'
import GlassDivider from '@renderer/components/Common/GlassDivider'

interface BibleSelectorDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (passage: BiblePassage) => void
}

type Step = 'books' | 'chapters' | 'verses'

const OLD_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(0, 39)
const NEW_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(39)

export function BibleSelectorDialog({
  isOpen,
  onOpenChange,
  onSelect
}: BibleSelectorDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState<Step>('books')
  const [selectedBook, setSelectedBook] = useState<number | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [bookSearch, setBookSearch] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCurrentStep('books')
        setSelectedChapter(null)
        setBookSearch('')
      }, 200)
    }
  }, [isOpen])

  const bookDetails = useMemo(
    () => (selectedBook ? (BIBLE_BOOKS.find((b) => b.number === selectedBook) ?? null) : null),
    [selectedBook]
  )

  const bookNamesMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const book of BIBLE_BOOKS) {
      map.set(
        book.code,
        (t as (k: string) => string)(`bible.books.${book.code.toLowerCase()}.name`)
      )
    }
    return map
  }, [t])

  const bookName = useCallback(
    (code: string): string => bookNamesMap.get(code) ?? code,
    [bookNamesMap]
  )

  const bookSearchLower = useMemo(() => bookSearch.toLowerCase(), [bookSearch])

  const filteredOT = useMemo(
    () =>
      OLD_TESTAMENT_BOOKS.filter((b) => bookName(b.code).toLowerCase().includes(bookSearchLower)),
    [bookName, bookSearchLower]
  )
  const filteredNT = useMemo(
    () =>
      NEW_TESTAMENT_BOOKS.filter((b) => bookName(b.code).toLowerCase().includes(bookSearchLower)),
    [bookName, bookSearchLower]
  )

  const handleBookSelect = useCallback((bookNumber: number): void => {
    setSelectedBook(bookNumber)
    const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
    if (book?.chapterCount === 1) {
      setSelectedChapter(1)
      setCurrentStep('verses')
    } else {
      setCurrentStep('chapters')
    }
  }, [])

  const handleChapterSelect = useCallback((chapter: number): void => {
    setSelectedChapter(chapter)
    setCurrentStep('verses')
  }, [])

  const handleVerseSelect = useCallback(
    (verse: number): void => {
      if (selectedBook && selectedChapter) {
        onSelect({ bookNumber: selectedBook, chapter: selectedChapter, verse })
        onOpenChange(false)
      }
    },
    [selectedBook, selectedChapter, onSelect, onOpenChange]
  )

  const verseCount = useMemo(() => {
    const versionId = useBibleSettingsStore.getState().selectedVersionId
    const books = versionId ? useBibleStore.getState().content.get(versionId) : undefined
    return (
      books
        ?.find((b) => b.number === selectedBook)
        ?.chapters.find((c) => c.number === selectedChapter)?.verses.length ?? 30
    )
  }, [selectedBook, selectedChapter])

  const chapterButtons = useMemo(() => {
    if (!bookDetails) return null
    return Array.from({ length: bookDetails.chapterCount }, (_, i) => i + 1)
  }, [bookDetails])

  const verseButtons = useMemo(
    () => Array.from({ length: verseCount }, (_, i) => i + 1),
    [verseCount]
  )

  const renderBooks = (): React.JSX.Element => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3">
          {filteredOT.map((book) => (
            <Button
              key={book.number}
              variant="tertiary"
              onPress={() => handleBookSelect(book.number)}
              className="w-full h-11 rounded-full text-xl"
            >
              {bookName(book.code)}
            </Button>
          ))}
        </div>
      </div>
      <GlassDivider />
      <div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {filteredNT.map((book) => (
            <Button
              key={book.number}
              variant="tertiary"
              onPress={() => handleBookSelect(book.number)}
              className="w-full h-11 rounded-full text-xl"
            >
              {bookName(book.code)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderChapters = (): React.JSX.Element | null => {
    if (!chapterButtons) return null
    return (
      <div className="grid grid-cols-10 gap-3">
        {chapterButtons.map((chapter) => (
          <Button
            key={chapter}
            isIconOnly
            variant="tertiary"
            onPress={() => handleChapterSelect(chapter)}
            className="w-18 h-18 rounded-full aspect-square text-3xl"
          >
            {chapter}
          </Button>
        ))}
      </div>
    )
  }

  const renderVerses = (): React.JSX.Element => (
    <div className="grid grid-cols-10 gap-3">
      {verseButtons.map((verse) => (
        <Button
          key={verse}
          isIconOnly
          variant="tertiary"
          onPress={() => handleVerseSelect(verse)}
          className="w-18 h-18 rounded-full aspect-square text-3xl"
        >
          {verse}
        </Button>
      ))}
    </div>
  )

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog
          aria-label={t('bible.selector.title')}
          className="max-w-4xl w-full h-full min-h-full p-1"
        >
          <Modal.Header className="p-1 pl-5 pb-3">
            <div className="flex justify-between items-center w-full gap-4">
              <Breadcrumbs>
                <Breadcrumbs.Item isDisabled>
                  {bookDetails ? bookName(bookDetails.code) : null}
                </Breadcrumbs.Item>
                {selectedChapter != null && (
                  <Breadcrumbs.Item isDisabled>{selectedChapter}</Breadcrumbs.Item>
                )}
              </Breadcrumbs>

              <div className="flex items-center gap-2">
                {currentStep === 'books' && (
                  <Input
                    aria-label={t('bible.selector.searchBook')}
                    placeholder={t('bible.selector.searchBook')}
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    className="w-36 border-0 border-b rounded-none shadow-none bg-transparent focus:ring-0"
                  />
                )}
                <Tabs
                  selectedKey={currentStep}
                  onSelectionChange={(key) => setCurrentStep(key as Step)}
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label={t('bible.selector.title')}>
                      <Tabs.Tab id="books">
                        {t('bible.selector.bookAbbr')}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab
                        id="chapters"
                        isDisabled={!selectedBook || bookDetails?.chapterCount === 1}
                      >
                        {t('bible.selector.chapterAbbr')}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="verses" isDisabled={selectedChapter == null}>
                        {t('bible.selector.verseAbbr')}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body className="flex flex-col overflow-hidden px-5">
            <ScrollShadow className="flex-1 min-h-0">
              {currentStep === 'books' && renderBooks()}
              {currentStep === 'chapters' && renderChapters()}
              {currentStep === 'verses' && renderVerses()}
            </ScrollShadow>
          </Modal.Body>
          <Modal.Footer className="p-1">
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              {t('bible.selector.close')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
