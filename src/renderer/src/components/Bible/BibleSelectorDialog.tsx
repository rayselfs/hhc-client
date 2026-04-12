import { useState, useEffect, type ReactNode } from 'react'
import { Modal, Button, ButtonGroup, Breadcrumbs, Divider } from '@heroui/react'
import { BIBLE_BOOKS } from '@shared/types/bible'
import type { BiblePassage } from '@shared/types/bible'
import { useBibleStore } from '@renderer/stores/bible'

interface BibleSelectorDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (passage: BiblePassage) => void
}

type Step = 'books' | 'chapters' | 'verses'

const OLD_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(0, 39)
const NEW_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(39)

const LabeledDivider = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center">
    <div className="flex-grow border-t border-default-200" />
    <span className="flex-shrink mx-4 text-default-500 text-sm">{children}</span>
    <div className="flex-grow border-t border-default-200" />
  </div>
)

export function BibleSelectorDialog({ isOpen, onClose, onSelect }: BibleSelectorDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>('books')
  const [selectedBook, setSelectedBook] = useState<number | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)

  // Reset state when dialog is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCurrentStep('books')
        setSelectedBook(null)
        setSelectedChapter(null)
      }, 200) // wait for modal close animation
    }
  }, [isOpen])

  const bookDetails = selectedBook ? BIBLE_BOOKS.find((b) => b.number === selectedBook) : null

  const handleBookSelect = (bookNumber: number) => {
    setSelectedBook(bookNumber)
    const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
    if (book?.chapterCount === 1) {
      setSelectedChapter(1)
      setCurrentStep('verses')
    } else {
      setCurrentStep('chapters')
    }
  }

  const handleChapterSelect = (chapter: number) => {
    setSelectedChapter(chapter)
    setCurrentStep('verses')
  }

  const handleVerseSelect = (verse: number) => {
    if (selectedBook && selectedChapter) {
      onSelect({ bookNumber: selectedBook, chapter: selectedChapter, verse })
      onClose()
    }
  }

  const renderBooks = () => (
    <div className="flex flex-col gap-4">
      <div>
        <LabeledDivider>舊約</LabeledDivider>
        <div className="grid grid-cols-4 gap-1 mt-2">
          {OLD_TESTAMENT_BOOKS.map((book) => (
            <Button key={book.number} size="sm" onPress={() => handleBookSelect(book.number)}>
              {book.name}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <LabeledDivider>新約</LabeledDivider>
        <div className="grid grid-cols-4 gap-1 mt-2">
          {NEW_TESTAMENT_BOOKS.map((book) => (
            <Button key={book.number} size="sm" onPress={() => handleBookSelect(book.number)}>
              {book.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderChapters = () => {
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

  const renderVerses = () => {
    const verseCount = useBibleStore.getState().getCurrentChapter()?.verses.length || 30
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

  const renderContent = () => {
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
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container size="lg">
        <Modal.Dialog>
          <Modal.Header>
            <div className="flex justify-between items-center w-full">
              <Breadcrumbs>
                <Breadcrumbs.Item
                  onPress={() => setCurrentStep('books')}
                  isDisabled={currentStep === 'books'}
                >
                  {bookDetails?.name || '書卷'}
                </Breadcrumbs.Item>
                {selectedChapter && (
                  <Breadcrumbs.Item
                    onPress={() => setCurrentStep('chapters')}
                    isDisabled={currentStep === 'chapters'}
                  >
                    {selectedChapter}
                  </Breadcrumbs.Item>
                )}
              </Breadcrumbs>
              <ButtonGroup>
                <Button
                  size="sm"
                  variant={currentStep === 'books' ? 'primary' : 'secondary'}
                  onPress={() => setCurrentStep('books')}
                >
                  書卷
                </Button>
                <Button
                  size="sm"
                  variant={currentStep === 'chapters' ? 'primary' : 'secondary'}
                  onPress={() => setCurrentStep('chapters')}
                  isDisabled={!selectedBook || bookDetails?.chapterCount === 1}
                >
                  章
                </Button>
                <Button
                  size="sm"
                  variant={currentStep === 'verses' ? 'primary' : 'secondary'}
                  onPress={() => setCurrentStep('verses')}
                  isDisabled={!selectedChapter}
                >
                  節
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
