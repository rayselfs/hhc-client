import { useState, useEffect } from 'react'
import { Modal, Button, ButtonGroup, Separator } from '@heroui/react'
import { BIBLE_BOOKS } from '@shared/types/bible'
import type { BiblePassage } from '@shared/types/bible'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useTranslation } from 'react-i18next'

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

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCurrentStep('books')
        setSelectedBook(null)
        setSelectedChapter(null)
      }, 200)
    }
  }, [isOpen])

  const bookDetails = selectedBook ? BIBLE_BOOKS.find((b) => b.number === selectedBook) : null

  const handleBookSelect = (bookNumber: number): void => {
    setSelectedBook(bookNumber)
    const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
    if (book?.chapterCount === 1) {
      setSelectedChapter(1)
      setCurrentStep('verses')
    } else {
      setCurrentStep('chapters')
    }
  }

  const handleChapterSelect = (chapter: number): void => {
    setSelectedChapter(chapter)
    setCurrentStep('verses')
  }

  const handleVerseSelect = (verse: number): void => {
    if (selectedBook && selectedChapter) {
      onSelect({ bookNumber: selectedBook, chapter: selectedChapter, verse })
      onOpenChange(false)
    }
  }

  const renderBooks = (): React.JSX.Element => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center">
          <Separator />
          <span className="flex-shrink mx-4 text-default-500 text-sm">
            {t('bible.selector.oldTestament')}
          </span>
          <Separator />
        </div>
        <div className="grid grid-cols-4 gap-1 mt-2">
          {OLD_TESTAMENT_BOOKS.map((book) => (
            <Button key={book.number} size="sm" onPress={() => handleBookSelect(book.number)}>
              {(t as (k: string) => string)(`bible.books.${book.code.toLowerCase()}.name`)}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center">
          <Separator />
          <span className="flex-shrink mx-4 text-default-500 text-sm">
            {t('bible.selector.newTestament')}
          </span>
          <Separator />
        </div>
        <div className="grid grid-cols-4 gap-1 mt-2">
          {NEW_TESTAMENT_BOOKS.map((book) => (
            <Button key={book.number} size="sm" onPress={() => handleBookSelect(book.number)}>
              {(t as (k: string) => string)(`bible.books.${book.code.toLowerCase()}.name`)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderChapters = (): React.JSX.Element | null => {
    if (!bookDetails) return null
    const chapters = Array.from({ length: bookDetails.chapterCount }, (_, i) => i + 1)
    return (
      <div className="grid grid-cols-10 gap-1">
        {chapters.map((chapter) => (
          <Button key={chapter} size="sm" isIconOnly onPress={() => handleChapterSelect(chapter)}>
            {chapter}
          </Button>
        ))}
      </div>
    )
  }

  const renderVerses = (): React.JSX.Element => {
    const versionId = useBibleSettingsStore.getState().selectedVersionId
    const books = versionId ? useBibleStore.getState().content.get(versionId) : undefined
    const verseCount =
      books
        ?.find((b) => b.number === selectedBook)
        ?.chapters.find((c) => c.number === selectedChapter)?.verses.length ?? 30
    const verses = Array.from({ length: verseCount }, (_, i) => i + 1)
    return (
      <div className="grid grid-cols-10 gap-1">
        {verses.map((verse) => (
          <Button key={verse} size="sm" isIconOnly onPress={() => handleVerseSelect(verse)}>
            {verse}
          </Button>
        ))}
      </div>
    )
  }

  const renderContent = (): React.JSX.Element | null => {
    switch (currentStep) {
      case 'books':
        return renderBooks()
      case 'chapters':
        return renderChapters()
      case 'verses':
        return renderVerses()
      default:
        return null
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="cover">
        <Modal.Dialog aria-label={t('bible.selector.title')}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <div className="flex justify-between items-center w-full">
              <nav className="flex items-center gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => setCurrentStep('books')}
                  disabled={currentStep === 'books'}
                  className="text-default-700 hover:text-foreground disabled:text-default-400 disabled:cursor-default transition-colors"
                >
                  {bookDetails
                    ? (t as (k: string) => string)(
                        `bible.books.${bookDetails.code.toLowerCase()}.name`
                      )
                    : t('bible.selector.book')}
                </button>
                {selectedChapter && (
                  <>
                    <span className="text-default-400">/</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('chapters')}
                      disabled={currentStep === 'chapters'}
                      className="text-default-700 hover:text-foreground disabled:text-default-400 disabled:cursor-default transition-colors"
                    >
                      {selectedChapter}
                    </button>
                  </>
                )}
              </nav>
              <ButtonGroup>
                <Button
                  size="sm"
                  variant={currentStep === 'books' ? 'primary' : 'secondary'}
                  onPress={() => setCurrentStep('books')}
                >
                  {t('bible.selector.book')}
                </Button>
                <Button
                  size="sm"
                  variant={currentStep === 'chapters' ? 'primary' : 'secondary'}
                  onPress={() => setCurrentStep('chapters')}
                  isDisabled={!selectedBook || bookDetails?.chapterCount === 1}
                >
                  {t('bible.selector.chapter')}
                </Button>
                <Button
                  size="sm"
                  variant={currentStep === 'verses' ? 'primary' : 'secondary'}
                  onPress={() => setCurrentStep('verses')}
                  isDisabled={!selectedChapter}
                >
                  {t('bible.selector.verse')}
                </Button>
              </ButtonGroup>
            </div>
          </Modal.Header>
          <Modal.Body>{renderContent()}</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
