import { ref, type Ref, type ComputedRef } from 'vue'
import { BibleFolder } from '@/types/enum'
import type { VerseItem } from '@/types/folder'
import type { BiblePassage } from '@/types/bible'

interface UseBibleVerseActionsOptions {
  currentPassage: Ref<BiblePassage | null> | ComputedRef<BiblePassage | null>
  previewVerses:
    | Ref<{ number: number; text: string }[]>
    | ComputedRef<{ number: number; text: string }[]>
  addToHistory: (item: VerseItem) => void
  setCurrentPassageVerse: (verseNumber: number) => void
  addVerseToCurrent: (verse: VerseItem) => void
  updateProjection: (verseNumber: number) => void
}

export function useBibleVerseActions(options: UseBibleVerseActionsOptions) {
  const {
    currentPassage,
    previewVerses,
    addToHistory,
    setCurrentPassageVerse,
    addVerseToCurrent,
    updateProjection,
  } = options

  const showVerseContextMenu = ref(false)
  const menuPosition = ref<[number, number] | undefined>(undefined)
  const selectedVerseItem = ref<{ number: number; text: string } | null>(null)

  const createMultiFunctionVerse = (verseNumber: number): VerseItem | null => {
    if (!currentPassage.value) return null

    const verseText = previewVerses.value.find((v) => v.number === verseNumber)?.text || ''

    return {
      id: crypto.randomUUID(),
      type: 'verse',
      folderId: BibleFolder.ROOT_ID,
      bookAbbreviation: currentPassage.value.bookAbbreviation,
      bookNumber: currentPassage.value.bookNumber,
      chapter: currentPassage.value.chapter,
      verse: verseNumber,
      verseText,
      timestamp: Date.now(),
    }
  }

  const addToHistoryFromVerse = (verseNumber: number) => {
    if (!currentPassage.value) return

    const newHistoryItem = createMultiFunctionVerse(verseNumber)
    if (!newHistoryItem) return

    addToHistory(newHistoryItem)
  }

  const selectVerse = (verseNumber: number) => {
    if (currentPassage.value) {
      setCurrentPassageVerse(verseNumber)
      addToHistoryFromVerse(verseNumber)
      updateProjection(verseNumber)
    }
  }

  const addVerseToCustom = (verseNumber: number) => {
    if (!currentPassage.value) return

    const newVerse = createMultiFunctionVerse(verseNumber)
    if (!newVerse) return

    addVerseToCurrent(newVerse)
  }

  const handleVerseRightClick = (event: MouseEvent, verse: { number: number; text: string }) => {
    event.preventDefault()
    selectedVerseItem.value = verse
    menuPosition.value = [event.clientX, event.clientY]
    showVerseContextMenu.value = true
  }

  return {
    showVerseContextMenu,
    menuPosition,
    selectedVerseItem,
    selectVerse,
    addVerseToCustom,
    handleVerseRightClick,
  }
}
