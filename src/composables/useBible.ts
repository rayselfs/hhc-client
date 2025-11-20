import { nextTick, computed, type Ref } from 'vue'
import { useFolderStore } from '@/stores/folder'
import { useElectron } from './useElectron'
import { useProjectionMessaging } from './useProjectionMessaging'
import { useProjectionStore } from '@/stores/projection'
import { APP_CONFIG } from '@/config/app'
import { MessageType, ViewType, StorageKey, StorageCategory, type VerseItem } from '@/types/common'
import type { BiblePassage, PreviewVerse, BibleBook } from '@/types/bible'

/**
 * 聖經功能整合 Composable
 * 整合 Bible folder store、導航功能和投影功能
 */
export const useBible = (
  currentPassage?: Ref<BiblePassage | null>,
  currentBookData?: Ref<BibleBook | null>,
  chapterVerses?: Ref<PreviewVerse[]>,
) => {
  // ==================== Folder Store ====================
  /**
   * Bible folder store instance
   * Manages folder structure for Bible verses
   */
  const folderStore = useFolderStore<VerseItem>({
    rootId: APP_CONFIG.FOLDER.ROOT_ID,
    defaultRootName: APP_CONFIG.FOLDER.DEFAULT_ROOT_NAME,
    storageCategory: StorageCategory.BIBLE,
    storageKey: StorageKey.FOLDERS,
  })

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
   * 滾動到指定節
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
   * 獲取最大章數（使用 computed 緩存）
   */
  const maxChapters = computed(() => {
    return currentBookData?.value ? currentBookData.value.chapters.length : 0
  })

  /**
   * 獲取最大章數（向後兼容的函數形式）
   * @deprecated 使用 maxChapters.value 替代
   */
  const getMaxChapters = (): number => {
    return maxChapters.value
  }

  /**
   * 更新章節內容
   */
  const updateChapterContent = (chapterNumber: number) => {
    if (!currentBookData?.value || !currentPassage?.value || !chapterVerses?.value) return false

    const selectedChapter = currentBookData.value.chapters.find((ch) => ch.number === chapterNumber)

    if (!selectedChapter) return false

    // 更新章節和節數（從第1節開始）
    currentPassage.value.chapter = chapterNumber
    currentPassage.value.verse = 1

    // 更新經文內容
    chapterVerses.value = selectedChapter.verses.map((v) => ({
      number: v.number,
      text: v.text,
    }))

    // 滾動到第1節
    nextTick(() => {
      scrollToVerse(1)
    })

    return true
  }

  /**
   * 導航到指定章節
   * @param direction - 'prev' | 'next' | number (章節號)
   * @param updateProjection - 是否更新投影（預設 false）
   * @param onUpdateProjection - 更新投影的回調函數
   */
  const navigateToChapter = (
    direction: 'prev' | 'next' | number,
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    if (!currentPassage?.value || !currentBookData?.value) return

    let targetChapter: number

    if (typeof direction === 'number') {
      targetChapter = direction
    } else if (direction === 'prev') {
      if (currentPassage.value.chapter <= 1) return
      targetChapter = currentPassage.value.chapter - 1
    } else {
      // 'next'
      const maxChapters = getMaxChapters()
      if (currentPassage.value.chapter >= maxChapters) return
      targetChapter = currentPassage.value.chapter + 1
    }

    const success = updateChapterContent(targetChapter)

    if (success && updateProjection && onUpdateProjection) {
      onUpdateProjection(1) // 新章節從第1節開始
    }
  }

  /**
   * 導航到上一章
   */
  const goToPreviousChapter = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToChapter('prev', updateProjection, onUpdateProjection)
  }

  /**
   * 導航到下一章
   */
  const goToNextChapter = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToChapter('next', updateProjection, onUpdateProjection)
  }

  /**
   * 導航到指定節
   * @param direction - 'prev' | 'next' | number (節號)
   * @param updateProjection - 是否更新投影（預設 false）
   * @param onUpdateProjection - 更新投影的回調函數
   */
  const navigateToVerse = (
    direction: 'prev' | 'next' | number,
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    if (!currentPassage?.value || !chapterVerses?.value) return

    let targetVerse: number

    if (typeof direction === 'number') {
      targetVerse = direction
    } else if (direction === 'prev') {
      if (currentPassage.value.verse <= 1) return
      targetVerse = currentPassage.value.verse - 1
    } else {
      // 'next'
      if (currentPassage.value.verse >= chapterVerses.value.length) return
      targetVerse = currentPassage.value.verse + 1
    }

    currentPassage.value.verse = targetVerse

    // 滾動到新節
    nextTick(() => {
      scrollToVerse(targetVerse)
    })

    if (updateProjection && onUpdateProjection) {
      onUpdateProjection(targetVerse)
    }
  }

  /**
   * 導航到上一節
   */
  const goToPreviousVerse = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToVerse('prev', updateProjection, onUpdateProjection)
  }

  /**
   * 導航到下一節
   */
  const goToNextVerse = (
    updateProjection = false,
    onUpdateProjection?: (verseNumber: number) => void,
  ) => {
    navigateToVerse('next', updateProjection, onUpdateProjection)
  }

  // ==================== Projection ====================
  const { isElectron, sendToProjection } = useElectron()
  const { setProjectionState, sendBibleUpdate } = useProjectionMessaging()
  const projectionStore = useProjectionStore()

  /**
   * 更新投影畫面
   */
  const updateProjection = async (verseNumber: number) => {
    if (!currentPassage?.value || !chapterVerses?.value) return

    if (isElectron()) {
      // 如果投影視窗沒有顯示聖經（顯示預設內容或顯示其他內容），則切換到聖經
      if (projectionStore.isShowingDefault || projectionStore.currentView !== 'bible') {
        await setProjectionState(false, ViewType.BIBLE)
      }
    }

    // 發送聖經數據
    const bibleData = {
      book: currentPassage.value.bookName,
      bookNumber: currentPassage.value.bookNumber,
      chapter: currentPassage.value.chapter,
      chapterVerses: chapterVerses.value.map((verse) => ({
        number: verse.number,
        text: verse.text,
      })),
      currentVerse: verseNumber,
    }

    sendBibleUpdate(bibleData, true)
  }

  /**
   * 更新投影字型大小
   */
  const updateProjectionFontSize = (fontSize: number) => {
    if (isElectron()) {
      sendToProjection({
        type: MessageType.UPDATE_BIBLE_FONT_SIZE,
        data: { fontSize },
      })
    }
  }

  return {
    // Folder Store
    folderStore,
    addVerseToCurrent,
    // Navigation
    scrollToVerse,
    maxChapters,
    getMaxChapters,
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
