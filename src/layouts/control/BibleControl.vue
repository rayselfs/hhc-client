<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Preview -->
      <v-col
        :cols="mdAndUp ? 6 : 12"
        :class="['pl-4 pt-4 pb-4', mdAndUp ? 'pr-2 mb-0' : 'pr-4 mb-4']"
        :style="{ height: `${leftCardHeight}px` }"
      >
        <v-card :style="{ height: `${leftCardHeight}px` }">
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <span class="mr-1">{{ $t('common.preview') }}</span>
              <div v-if="currentPassage && !isSearchMode">
                <span class="mr-1"
                  >({{ localizedBookName }} {{ currentPassage.chapter }}:{{
                    currentPassage.verse
                  }})</span
                >
              </div>
              <div v-if="isSearchMode">
                <span>({{ $t('common.search') }})</span>
              </div>
            </div>
            <div v-if="currentPassage" class="d-flex align-center gap-2">
              <v-btn
                size="small"
                class="mr-1"
                :disabled="isSearchMode || currentPassage.chapter <= 1"
                @click="goToPreviousChapterPreview"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
              <v-btn
                size="small"
                :disabled="isSearchMode || currentPassage.chapter >= maxChapters"
                @click="goToNextChapterPreview"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </div>
          </v-card-title>

          <v-divider />

          <v-card-text
            class="bible-content-wrapper pl-2 pr-2 pa-0"
            :style="{ height: `${leftCardHeight - 48}px`, position: 'relative' }"
          >
            <!-- Loading State -->
            <div
              class="align-center justify-center"
              :class="{ 'd-none': !isLoadingVerses, 'd-flex': isLoadingVerses }"
              :style="{ height: `${leftCardHeight - 48}px` }"
            >
              <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            </div>

            <!-- Search Results -->
            <div class="bible-content" v-show="!isLoadingVerses && isSearchMode">
              <!-- No Results -->
              <div
                v-if="searchResultsDisplay.length === 0 && !isLoadingVerses"
                class="d-flex align-center justify-center"
                :style="{ height: `${leftCardHeight - 48}px` }"
              >
                <div class="text-center">
                  <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-magnify</v-icon>
                  <div class="text-h6 text-grey">
                    {{ $t('bible.search.noResults') }}
                  </div>
                </div>
              </div>

              <!-- Result List -->
              <template v-else>
                <div
                  v-for="result in searchResultsDisplay"
                  :key="result.verse_id"
                  class="verse-item mb-2 d-flex align-center"
                  @click="handleSearchResultClick(result)"
                >
                  <div class="verse-content d-flex align-start flex-1 text-h6">
                    <span class="mr-1 text-subtitle-1 font-weight-medium search-verse-reference">
                      {{ result.book_abbreviation }}{{ result.chapter_number }}:{{
                        result.verse_number
                      }}
                    </span>
                    <span class="mr-1 text-subtitle-1">-</span>
                    <p class="text-justify" v-html="highlightSearchText(result.text)"></p>
                  </div>
                </div>
              </template>
            </div>

            <!-- Verse Content -->
            <div class="bible-content" v-show="!isLoadingVerses && !isSearchMode">
              <div
                v-for="verse in previewVerses"
                :key="verse.number"
                :data-verse="verse.number"
                class="verse-item mb-2 d-flex align-center"
                :class="{
                  'verse-highlighted': currentPassage && verse.number === currentPassage.verse,
                }"
                @click="selectVerse(verse.number)"
                @contextmenu="handleVerseRightClick($event, verse)"
              >
                <div class="verse-content d-flex align-start flex-1 text-h6">
                  <span class="verse-number mr-1 text-subtitle-1">{{ verse.number }}</span>
                  <span class="text-justify">{{ verse.text }}</span>
                </div>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  class="verse-btn"
                  @click.stop="addVerseToCustom(verse.number)"
                >
                  <v-icon size="small">mdi-plus</v-icon>
                </v-btn>
              </div>
              <BottomSpacer />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        :cols="mdAndUp ? 6 : 12"
        :class="['pt-4 pb-4 pr-4', mdAndUp ? 'pl-2' : 'pl-4']"
        ref="rightColumnContainer"
      >
        <v-row no-gutters class="fill-height">
          <!-- Multi Function Control -->
          <v-col cols="12" class="mb-4" :style="{ height: `${rightTopCardHeight}px` }">
            <MultiFunctionControl :container-height="rightTopCardHeight" @load-verse="loadVerse" />
          </v-col>

          <!-- Projection Control -->
          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <v-card :style="{ height: `${rightBottomCardHeight}px` }">
              <v-card-text>
                <!-- Chapter/Verse Navigation -->
                <v-row class="mb-3">
                  <v-col cols="6">
                    <v-label class="text-subtitle-1">{{ $t('bible.controlChapter') }}</v-label>
                  </v-col>
                  <v-col cols="6">
                    <v-label class="text-subtitle-1">{{ $t('bible.controlVerse') }}</v-label>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-end pa-0 pr-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.chapter <= 1"
                      @click="goToPreviousChapterProjection"
                    >
                      <v-icon>mdi-chevron-left</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-start pa-0 pl-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.chapter >= maxChapters"
                      @click="goToNextChapterProjection"
                    >
                      <v-icon>mdi-chevron-right</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-end pa-0 pr-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!currentPassage || currentPassage.verse <= 1"
                      @click="goToPreviousVerseProjection"
                    >
                      <v-icon>mdi-chevron-up</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="3" class="d-flex justify-start pa-0 pl-2">
                    <v-btn
                      icon
                      variant="outlined"
                      :disabled="!hasCurrentPassage || (currentPassage?.verse ?? 0) >= maxVerse"
                      @click="goToNextVerseProjection"
                    >
                      <v-icon>mdi-chevron-down</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>
                <!-- Font Size Slider -->
                <v-row>
                  <v-col cols="12">
                    <v-label class="text-subtitle-1 mb-2">{{
                      $t('bible.controlFontSize')
                    }}</v-label>
                    <v-slider
                      v-model="fontSize"
                      :min="BIBLE_CONFIG.FONT.MIN_SIZE"
                      :max="BIBLE_CONFIG.FONT.MAX_SIZE"
                      :step="BIBLE_CONFIG.FONT.SIZE_STEP"
                      thumb-label
                      @update:model-value="handleFontSizeUpdate"
                    >
                      <template #thumb-label="{ modelValue }"> {{ modelValue }}px </template>
                    </v-slider>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Context Menu -->
    <ContextMenu v-model="showVerseContextMenu" :position="menuPosition" close-on-content-click raw>
      <BibleVerseContextMenu type="preview" @copy-verse-text="copyVerseText" />
    </ContextMenu>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'
import { APP_CONFIG, BIBLE_CONFIG, BIBLE_BOOKS } from '@/config/app'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import type { VerseItem } from '@/types/common'
import type { BiblePassage, SearchResult, SearchResultDisplay } from '@/types/bible'
import { useSentry } from '@/composables/useSentry'
import { useCardLayout } from '@/composables/useLayout'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useBible } from '@/composables/useBible'
import ContextMenu from '@/components/ContextMenu.vue'
import { BibleVerseContextMenu } from '@/components/Bible'
import MultiFunctionControl from '@/components/Bible/MultiFunction/Control.vue'
import BottomSpacer from '@/components/Main/BottomSpacer.vue'
import { useBibleFolderStore } from '@/stores/folder'
import { BibleFolder } from '@/types/enum'

const { t: $t } = useI18n()
const { reportError } = useSentry()
const { getLocalItem, setLocalItem } = useLocalStorage()
const bibleStore = useBibleStore()
const bibleFolderStore = useBibleFolderStore()
const { mdAndUp } = useDisplay()
const {
  currentVersion,
  selectedVerse: storeSelectedVerse,
  currentBibleContent,
  currentPassage,
  previewVerses,
  previewBook,
  isMultiVersion,
  secondVersionCode,
} = storeToRefs(bibleStore)
const {
  getBibleContent,
  addToHistory,
  setPreviewState,
  setCurrentPassageVerse,
  searchBibleVerses,
} = bibleStore

const { loadChildren } = bibleFolderStore

const { leftCardHeight, rightTopCardHeight, rightBottomCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
  topCardRatio: 0.7,
})

// Font size control
const getInitialFontSize = () => {
  const savedFontSize = getLocalItem<number>(
    getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
  )
  return savedFontSize ? savedFontSize : BIBLE_CONFIG.FONT.DEFAULT_SIZE
}
const fontSize = ref(getInitialFontSize())

// Use Bible composable for folder management, navigation and projection
const {
  addVerseToCurrent,
  scrollToVerse,
  maxChapters,
  goToPreviousChapter,
  goToNextChapter,
  goToPreviousVerse,
  goToNextVerse,
  updateProjection,
  updateProjectionFontSize: updateFontSize,
} = useBible(currentPassage, previewBook, previewVerses)

// Optimized computed properties (cached)
const maxVerse = computed(() => previewVerses.value.length)
const hasCurrentPassage = computed(() => !!currentPassage.value)
const localizedBookName = computed(() => {
  const passage = currentPassage.value
  if (!passage) return ''

  const bookConfig = BIBLE_BOOKS.find((b) => b.number === passage.bookNumber)
  if (bookConfig) {
    return $t(`bible.books.${bookConfig.code}`)
  }
  return ''
})

// Loading state
const isLoadingVerses = ref(false)

// Search state
const searchResults = ref<SearchResult[]>([])
const isSearchMode = ref(false)
const searchText = ref('')

// Display search results (with book abbreviation)
const searchResultsDisplay = computed<SearchResultDisplay[]>(() => {
  if (!currentBibleContent.value || searchResults.value.length === 0) {
    return []
  }

  return searchResults.value.map((result) => {
    const book = currentBibleContent.value?.books.find((b) => b.number === result.book_number)
    return {
      ...result,
      book_abbreviation: book?.abbreviation || '',
    }
  })
})

// Highlight search keywords
const searchRegex = computed(() => {
  if (!searchText.value) {
    return null
  }
  const escapedSearchTerm = searchText.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(${escapedSearchTerm})`, 'gi')
})

const highlightSearchText = (text: string): string => {
  if (!searchRegex.value || !text) {
    return text
  }

  const highlighted = text.replace(
    searchRegex.value,
    '<span style="color: rgb(var(--v-theme-error));">$1</span>',
  )
  return highlighted
}

// Context menu refs
const showVerseContextMenu = ref(false)
const menuPosition = ref<[number, number] | undefined>(undefined)
const selectedVerse = ref<{ number: number; text: string } | null>(null)

// Handle verse selection for preview
const handleVerseSelection = async (bookNumber: number, chapter: number, verse: number) => {
  try {
    const versionCode = currentVersion.value?.code
    if (!versionCode) {
      reportError(new Error('No Bible version selected'), {
        operation: 'handle-verse-selection',
        component: 'BibleControl',
        extra: { bookNumber, chapter, verse },
      })
      return
    }

    // Fetch Bible content from store
    const content = await getBibleContent(versionCode)
    if (!content) {
      reportError(new Error('Bible content not found'), {
        operation: 'handle-verse-selection',
        component: 'BibleControl',
        extra: { versionCode, bookNumber, chapter, verse },
      })
      return
    }

    // Find book in content
    const book = content.books.find((b) => b.number === bookNumber)
    if (!book) {
      reportError(new Error('Book not found'), {
        operation: 'handle-verse-selection',
        component: 'BibleControl',
        extra: { versionCode, bookNumber, chapter, verse },
      })
      return
    }

    // Prepare new passage info
    const newPassage: BiblePassage = {
      bookAbbreviation: book.abbreviation || '',
      bookNumber: book.number,
      chapter,
      verse,
    }

    // Get actual verses from selected chapter
    const selectedChapter = book.chapters.find((ch) => ch.number === chapter)
    if (selectedChapter) {
      // Prepare new verse content
      const newVerses = selectedChapter.verses.map((v: { number: number; text: string }) => ({
        number: v.number,
        text: v.text,
      }))

      // Update store state
      setPreviewState(newPassage, newVerses, book)

      // Wait for DOM update
      await nextTick()

      // Scroll to specific verse (use setTimeout to avoid blocking)
      setTimeout(() => {
        scrollToVerse(verse, 'instant')
      }, 0)
    }
  } finally {
    // Ensure loading state is always reset, even if an error occurs
    isLoadingVerses.value = false
  }
}

/**
 * Create VerseItem object
 * @param verseNumber - Verse number
 * @returns VerseItem object, or null if no current passage
 */
const createMultiFunctionVerse = (verseNumber: number): VerseItem | null => {
  if (!currentPassage.value) return null

  const verseText = previewVerses.value.find((v) => v.number === verseNumber)?.text || ''

  return {
    id: crypto.randomUUID(),
    type: 'verse',
    bookAbbreviation: currentPassage.value.bookAbbreviation,
    bookNumber: currentPassage.value.bookNumber,
    chapter: currentPassage.value.chapter,
    verse: verseNumber,
    verseText,
    timestamp: Date.now(),
  }
}

// Add to history
const addToHistoryFromVerse = (verseNumber: number) => {
  if (!currentPassage.value) return

  const newHistoryItem = createMultiFunctionVerse(verseNumber)
  if (!newHistoryItem) return

  addToHistory(newHistoryItem)
}

// Select verse on click
const selectVerse = (verseNumber: number) => {
  if (currentPassage.value) {
    setCurrentPassageVerse(verseNumber)
    addToHistoryFromVerse(verseNumber)
    updateProjection(verseNumber)
  }
}

// Previous Chapter (Preview only)
const goToPreviousChapterPreview = () => {
  goToPreviousChapter(false)
}

// Next Chapter (Preview only)
const goToNextChapterPreview = () => {
  goToNextChapter(false)
}

// Projection Control Functions
// Previous Chapter (Affects Projection)
const goToPreviousChapterProjection = () => {
  goToPreviousChapter(true, updateProjection)
}

// Next Chapter (Affects Projection)
const goToNextChapterProjection = () => {
  goToNextChapter(true, updateProjection)
}

// Previous Verse (Affects Projection)
const goToPreviousVerseProjection = () => {
  goToPreviousVerse(true, updateProjection)
}

// Next Verse (Affects Projection)
const goToNextVerseProjection = () => {
  goToNextVerse(true, updateProjection)
}

// Update projection font size
const handleFontSizeUpdate = () => {
  setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE), fontSize.value)
  updateFontSize(fontSize.value)
}

// History related functions
const loadVerse = async (item: VerseItem, type: 'history' | 'custom') => {
  try {
    isLoadingVerses.value = true
    await handleVerseSelection(item.bookNumber, item.chapter, item.verse)

    if (type === 'custom') {
      updateProjection(item.verse)
    }
  } catch (error) {
    reportError(error, {
      operation: 'load-verse',
      component: 'BibleControl',
      extra: { verseId: item.id },
    })
  }
}

const addVerseToCustom = (verseNumber: number) => {
  if (!currentPassage.value) return

  const newVerse = createMultiFunctionVerse(verseNumber)
  if (!newVerse) return

  // Call store action - it handles duplicate checking
  addVerseToCurrent(newVerse)
}

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  // Avoid triggering shortcuts in input fields
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  // Only respond if passage is selected
  if (!currentPassage.value) return

  switch (event.code) {
    case 'ArrowUp':
      event.preventDefault()
      goToPreviousVerseProjection()
      break
    case 'ArrowDown':
      event.preventDefault()
      goToNextVerseProjection()
      break
  }
}

// Context menu handler
const handleVerseRightClick = (event: MouseEvent, verse: { number: number; text: string }) => {
  event.preventDefault()
  selectedVerse.value = verse
  menuPosition.value = [event.clientX, event.clientY]
  showVerseContextMenu.value = true
}

const copyVerseText = async () => {
  if (selectedVerse.value && currentPassage.value) {
    const verseText = `"${selectedVerse.value.text}" ${localizedBookName.value} ${currentPassage.value.chapter}:${selectedVerse.value.number}`

    try {
      await navigator.clipboard.writeText(verseText)
    } catch (err) {
      reportError(err, {
        operation: 'copy-verse-text',
        component: 'BibleControl',
        extra: { text: verseText },
      })
      // Fallback: Use deprecated copy method
      const textArea = document.createElement('textarea')
      textArea.value = verseText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }
  showVerseContextMenu.value = false
}

// Watch store selection state
watch(
  storeSelectedVerse,
  async (newVerse) => {
    if (newVerse) {
      isSearchMode.value = false // avoid stuck in search mode
      isLoadingVerses.value = true
      await handleVerseSelection(newVerse.bookNumber, newVerse.chapter, newVerse.verse)
    }
  },
  { immediate: false },
)

// Handle search result click
const handleSearchResultClick = async (result: SearchResult) => {
  isSearchMode.value = false
  isLoadingVerses.value = true
  await handleVerseSelection(result.book_number, result.chapter_number, result.verse_number)
}

// Watch for version changes to auto-update content
watch(
  () => currentVersion.value?.code,
  async (newCode, oldCode) => {
    if (newCode && newCode !== oldCode && currentPassage.value) {
      isLoadingVerses.value = true
      const { bookNumber, chapter, verse } = currentPassage.value
      await handleVerseSelection(bookNumber, chapter, verse)
    }
  },
)

// Watch multi-version state changes to update projection immediately
watch([isMultiVersion, secondVersionCode], async ([newIsMulti, newSecondCode]) => {
  // Only update if we have a current passage and verse
  if (currentPassage.value && currentPassage.value.verse) {
    // If enabling multi-version, we need to make sure we have a second version code
    if (newIsMulti && !newSecondCode) {
      return
    }
    await updateProjection(currentPassage.value.verse)
  }
})

// Handle search
const handleSearch = async (text: string) => {
  if (!text.trim()) {
    return
  }

  const versionCode = currentVersion.value?.code
  if (!versionCode) {
    reportError(new Error('No Bible version selected'), {
      operation: 'handle-search',
      component: 'BibleControl',
      extra: { searchText: text },
    })
    return
  }

  // Set loading state
  isLoadingVerses.value = true
  isSearchMode.value = true

  try {
    // Save search text for highlighting
    searchText.value = text.trim()

    // Execute search using store's search function
    const results = await searchBibleVerses(
      text.trim(),
      versionCode,
      BIBLE_CONFIG.SEARCH.DEFAULT_RESULT_LIMIT,
    )
    searchResults.value = results
  } catch (error) {
    reportError(error, {
      operation: 'handle-search',
      component: 'BibleControl',
      extra: { searchText: text, versionCode },
    })
    searchResults.value = []
  } finally {
    isLoadingVerses.value = false
  }
}

const handleSearchEvent = (event: Event) => {
  const customEvent = event as CustomEvent<{ text: string }>
  handleSearch(customEvent.detail.text)
}

onMounted(async () => {
  bibleFolderStore.loadRootFolder()
  await loadChildren(BibleFolder.ROOT_ID)

  updateFontSize(fontSize.value)

  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('bible-search', handleSearchEvent)
})

onUnmounted(() => {
  window.removeEventListener('bible-search', handleSearchEvent)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.bible-content-wrapper {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.bible-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

.bible-content {
  line-height: 1.8;
}

.verse-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.verse-number {
  min-width: 20px;
  text-align: right;
}

.history-verse-number {
  min-width: 80px;
}

.verse-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 8px;
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.5);
}

.verse-highlighted {
  background-color: rgba(var(--v-theme-primary), 0.4);
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}

.verse-content {
  flex: 1;
}

.search-verse-reference {
  white-space: nowrap;
  flex-shrink: 0;
}

.search-highlight {
  color: rgb(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.1);
  padding: 2px 4px;
  border-radius: 2px;
}
</style>
