import { nextTick, computed, type Ref } from 'vue'
import { useElectron } from './useElectron'
import { useProjectionMessaging } from './useProjectionMessaging'
import { MessageType, ViewType, type VerseItem } from '@/types/common'
import { useBibleStore } from '@/stores/bible'
import { storeToRefs } from 'pinia'
import type { BiblePassage, PreviewVerse, BibleBook } from '@/types/bible'
import { useBibleFolderStore } from '@/stores/folder'

const folderStore = useBibleFolderStore()

/**
 * Bible Functionality Integration Composable
 * Integrates Bible folder store, navigation, and projection features
 */
export const useBible = (
  currentPassage?: Ref<BiblePassage | null>,
  previewBook?: Ref<BibleBook | null>,
  previewVerses?: Ref<PreviewVerse[]>,
) => {
  /**
   * Add a verse to the current folder with duplicate checking
   * Bible-specific business logic: checks for duplicate verses based on book, chapter, and verse number
   * @param verse - The verse item to add
   * @returns true if added, false if duplicate
   */
  const addVerseToCurrent = (verse: VerseItem): boolean => {
    // Bible-specific duplicate check: same book, chapter, and verse
    const exists = folderStore.currentFolder.items.some(
      (item: VerseItem) =>
        item.bookNumber === verse.bookNumber &&
        item.chapter === verse.chapter &&
        item.verse === verse.verse,
    )

    if (!exists) {
      folderStore.addItemToCurrent(verse)
      return true
    }
    return false
  }

  // ==================== Navigation ====================
  /**
   * Scroll to specific verse
   */
  const scrollToVerse = (verseNumber: number, behavior: 'smooth' | 'instant' = 'smooth') => {
    const element = document.querySelector(`[data-verse="${verseNumber}"]`)
    if (element) {
      element.scrollIntoView({
        behavior: behavior,
        block: 'start',
      })
    }
  }

  /**
   * Get max chapters (cached using computed)
   */
  const maxChapters = computed(() => {
    return previewBook?.value ? previewBook.value.chapters.length : 0
  })

  /**
   * Update chapter content
   */
  const updateChapterContent = (chapterNumber: number) => {
    if (!previewBook?.value || !currentPassage?.value || !previewVerses?.value) return false

    const selectedChapter = previewBook.value.chapters.find((ch) => ch.number === chapterNumber)

    if (!selectedChapter) return false

    // Update chapter and verse (start from verse 1)
    currentPassage.value.chapter = chapterNumber
    currentPassage.value.verse = 1

    // Update scripture content
    previewVerses.value = selectedChapter.verses.map((v) => ({
      number: v.number,
      text: v.text,
    }))

    // Scroll to verse 1
    nextTick(() => {
      scrollToVerse(1)
    })

    return true
  }

  /**
   * Navigate to specific chapter
   * @param direction - 'prev' | 'next' | number (chapter number)
   * @param updateProjection - Whether to update projection (default false)
   * @param onUpdateProjection - Callback for updating projection
   */
  const navigateToChapter = (
    direction: 'prev' | 'next' | number,
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    if (!currentPassage?.value || !previewBook?.value) return

    let targetChapter: number

    if (typeof direction === 'number') {
      targetChapter = direction
    } else if (direction === 'prev') {
      if (currentPassage.value.chapter <= 1) return
      targetChapter = currentPassage.value.chapter - 1
    } else {
      // 'next'
      if (currentPassage.value.chapter >= maxChapters.value) return
      targetChapter = currentPassage.value.chapter + 1
    }

    const success = updateChapterContent(targetChapter)

    if (success && updateProjection && onUpdateProjection) {
      onUpdateProjection(1) // New chapter starts at verse 1
    }
  }

  /**
   * Navigate to previous chapter
   */
  const goToPreviousChapter = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToChapter('prev', updateProjection, onUpdateProjection)
  }

  /**
   * Navigate to next chapter
   */
  const goToNextChapter = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToChapter('next', updateProjection, onUpdateProjection)
  }

  /**
   * Navigate to specific verse
   * @param direction - 'prev' | 'next' | number (verse number)
   * @param updateProjection - Whether to update projection (default false)
   * @param onUpdateProjection - Callback for updating projection
   */
  const navigateToVerse = (
    direction: 'prev' | 'next' | number,
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    if (!currentPassage?.value || !previewVerses?.value) return

    let targetVerse: number

    if (typeof direction === 'number') {
      targetVerse = direction
    } else if (direction === 'prev') {
      if (currentPassage.value.verse <= 1) return
      targetVerse = currentPassage.value.verse - 1
    } else {
      // 'next'
      if (currentPassage.value.verse >= previewVerses.value.length) return
      targetVerse = currentPassage.value.verse + 1
    }

    currentPassage.value.verse = targetVerse

    // Scroll to new verse
    nextTick(() => {
      scrollToVerse(targetVerse)
    })

    if (updateProjection && onUpdateProjection) {
      onUpdateProjection(targetVerse)
    }
  }

  /**
   * Navigate to previous verse
   */
  const goToPreviousVerse = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToVerse('prev', updateProjection, onUpdateProjection)
  }

  /**
   * Navigate to next verse
   */
  const goToNextVerse = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToVerse('next', updateProjection, onUpdateProjection)
  }

  // ==================== Projection ====================
  const { isElectron, sendToProjection } = useElectron()
  const { setProjectionState, sendProjectionMessage } = useProjectionMessaging()

  /**
   * Update projection screen
   * @param verseNumber - The clicked verse number
   */
  const updateProjection = async (verseNumber: number) => {
    if (!currentPassage?.value || !previewVerses?.value) return

    if (isElectron()) {
      await setProjectionState(false, ViewType.BIBLE)
    }

    // Get Bible store state
    const bibleStore = useBibleStore()
    const { isMultiVersion, secondVersionCode } = storeToRefs(bibleStore)
    const { getBibleContent } = bibleStore

    let secondVersionVerses: Array<{ number: number; text: string }> | undefined

    // If multi-version is enabled and a second version is selected, fetch its content
    if (isMultiVersion.value && secondVersionCode.value) {
      try {
        const content = await getBibleContent(secondVersionCode.value)
        if (content) {
          const book = content.books.find((b) => b.number === currentPassage.value!.bookNumber)
          if (book) {
            const chapter = book.chapters.find((c) => c.number === currentPassage.value!.chapter)
            if (chapter) {
              secondVersionVerses = chapter.verses.map((v) => ({
                number: v.number,
                text: v.text,
              }))
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch second version content:', error)
      }
    }

    // Send Bible data
    const bibleData = {
      bookNumber: currentPassage.value.bookNumber,
      chapter: currentPassage.value.chapter,
      chapterVerses: previewVerses.value.map((verse) => ({
        number: verse.number,
        text: verse.text,
      })),
      currentVerse: verseNumber,
      isMultiVersion: isMultiVersion.value,
      secondVersionChapterVerses: secondVersionVerses,
    }

    sendProjectionMessage(MessageType.BIBLE_SYNC_CONTENT, bibleData, { force: true })
  }

  /**
   * Update projection font size
   */
  const updateProjectionFontSize = (fontSize: number) => {
    if (isElectron()) {
      sendToProjection({
        type: MessageType.BIBLE_UPDATE_FONT_SIZE,
        data: { fontSize },
      })
    }
  }

  return {
    addVerseToCurrent,
    // Navigation
    scrollToVerse,
    maxChapters,
    navigateToChapter,
    goToPreviousChapter,
    goToNextChapter,
    navigateToVerse,
    goToPreviousVerse,
    goToNextVerse,
    // Projection
    updateProjection,
    updateProjectionFontSize,
  }
}
