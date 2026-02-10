<template>
  <v-card :style="{ height: `${props.height}px` }" rounded="lg">
    <v-card-title>
      <slot name="header"></slot>
    </v-card-title>

    <v-divider />

    <v-card-text
      class="bible-content-wrapper pl-2 pr-2 pa-0"
      :style="{ height: `${props.height - 48}px`, position: 'relative' }"
    >
      <!-- Loading State -->
      <div
        class="align-center justify-center"
        :class="{ 'd-none': !isLoadingVerses, 'd-flex': isLoadingVerses }"
        :style="{ height: `${props.height - 48}px` }"
      >
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      </div>

      <!-- Search Results -->
      <div class="bible-content" v-show="!isLoadingVerses && isSearchMode">
        <!-- No Results -->
        <div
          v-if="searchResultsDisplay.length === 0 && !isLoadingVerses"
          class="d-flex align-center justify-center"
          :style="{ height: `${props.height - 48}px` }"
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
                {{ result.book_abbreviation }}{{ result.chapter_number }}:{{ result.verse_number }}
              </span>
              <span class="mr-1 text-subtitle-1">-</span>
              <p class="text-justify" v-html="sanitizeHTML(highlightSearchText(result.text))"></p>
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

  <!-- Context Menu -->
  <ContextMenu v-model="showVerseContextMenu" :position="menuPosition" close-on-content-click raw>
    <BibleVerseContextMenu type="preview" @copy-verse-text="copyVerseText" />
  </ContextMenu>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'
import { useBible } from '@/composables/useBible'
import { BIBLE_CONFIG, BIBLE_BOOKS } from '@/config/app'
import { sanitizeHTML } from '@/utils/sanitize'
import { useSentry } from '@/composables/useSentry'
import ContextMenu from '@/components/ContextMenu.vue'
import { BibleVerseContextMenu } from '@/components/Bible'
import BottomSpacer from '@/components/Main/BottomSpacer.vue'
import { BibleFolder } from '@/types/enum'
import type { VerseItem } from '@/types/common'
import type { BiblePassage, SearchResult, SearchResultDisplay } from '@/types/bible'

interface Props {
  height: number
}

const props = defineProps<Props>()

const { t: $t } = useI18n()
const { reportError } = useSentry()
const bibleStore = useBibleStore()

const {
  currentVersion,
  currentBibleContent,
  currentPassage,
  previewVerses,
  previewBook,
  selectedVerse: storeSelectedVerse,
} = storeToRefs(bibleStore)

const {
  getBibleContent,
  addToHistory,
  setPreviewState,
  setCurrentPassageVerse,
  searchBibleVerses,
} = bibleStore

const { addVerseToCurrent, scrollToVerse, updateProjection } = useBible(
  currentPassage,
  previewBook,
  previewVerses,
)

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
  return sanitizeHTML(highlighted)
}

// Context menu refs
const showVerseContextMenu = ref(false)
const menuPosition = ref<[number, number] | undefined>(undefined)
const selectedVerseItem = ref<{ number: number; text: string } | null>(null)

const localizedBookName = computed(() => {
  const passage = currentPassage.value
  if (!passage) return ''

  const bookConfig = BIBLE_BOOKS.find((b) => b.number === passage.bookNumber)
  if (bookConfig) {
    return $t(`bible.books.${bookConfig.code}`)
  }
  return ''
})

// Handle verse selection for preview
const handleVerseSelection = async (bookNumber: number, chapter: number, verse: number) => {
  try {
    const versionCode = currentVersion.value?.code
    if (!versionCode) {
      reportError(new Error('No Bible version selected'), {
        operation: 'handle-verse-selection',
        component: 'BiblePreview',
        extra: { bookNumber, chapter, verse },
      })
      return
    }

    // Fetch Bible content from store
    const content = await getBibleContent(versionCode)
    if (!content) {
      reportError(new Error('Bible content not found'), {
        operation: 'handle-verse-selection',
        component: 'BiblePreview',
        extra: { versionCode, bookNumber, chapter, verse },
      })
      return
    }

    // Find book in content
    const book = content.books.find((b) => b.number === bookNumber)
    if (!book) {
      reportError(new Error('Book not found'), {
        operation: 'handle-verse-selection',
        component: 'BiblePreview',
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

const copyVerseText = async () => {
  if (selectedVerseItem.value && currentPassage.value) {
    const verseText = `"${selectedVerseItem.value.text}" ${localizedBookName.value} ${currentPassage.value.chapter}:${selectedVerseItem.value.number}`

    try {
      await navigator.clipboard.writeText(verseText)
    } catch (err) {
      reportError(err, {
        operation: 'copy-verse-text',
        component: 'BiblePreview',
        extra: { text: verseText },
      })
      // Fallback
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

const handleSearch = async (text: string) => {
  if (!text.trim()) {
    return
  }

  const versionCode = currentVersion.value?.code
  if (!versionCode) {
    reportError(new Error('No Bible version selected'), {
      operation: 'handle-search',
      component: 'BiblePreview',
      extra: { searchText: text },
    })
    return
  }

  isLoadingVerses.value = true
  isSearchMode.value = true

  try {
    searchText.value = text.trim()
    const results = await searchBibleVerses(
      text.trim(),
      versionCode,
      BIBLE_CONFIG.SEARCH.DEFAULT_RESULT_LIMIT,
    )
    searchResults.value = results
  } catch (error) {
    reportError(error, {
      operation: 'handle-search',
      component: 'BiblePreview',
      extra: { searchText: text, versionCode },
    })
    searchResults.value = []
  } finally {
    isLoadingVerses.value = false
  }
}

const handleSearchResultClick = async (result: SearchResult) => {
  isSearchMode.value = false
  isLoadingVerses.value = true
  await handleVerseSelection(result.book_number, result.chapter_number, result.verse_number)
}

const handleSearchEvent = (event: Event) => {
  const customEvent = event as CustomEvent<{ text: string }>
  handleSearch(customEvent.detail.text)
}

const handleSelectVerseEvent = async (event: Event) => {
  const customEvent = event as CustomEvent<{ bookNumber: number; chapter: number; verse: number }>
  const { bookNumber, chapter, verse } = customEvent.detail
  isLoadingVerses.value = true
  await handleVerseSelection(bookNumber, chapter, verse)
}

watch(
  storeSelectedVerse,
  async (newVerse) => {
    if (newVerse) {
      isSearchMode.value = false
      isLoadingVerses.value = true
      await handleVerseSelection(newVerse.bookNumber, newVerse.chapter, newVerse.verse)
    }
  },
  { immediate: false },
)

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

onMounted(() => {
  window.addEventListener('bible-search', handleSearchEvent)
  window.addEventListener('bible-select-verse', handleSelectVerseEvent)
})

onUnmounted(() => {
  window.removeEventListener('bible-search', handleSearchEvent)
  window.removeEventListener('bible-select-verse', handleSelectVerseEvent)
})

defineExpose({
  isLoadingVerses,
  isSearchMode,
  handleVerseSelection,
})
</script>

<style scoped>
.bible-content-wrapper {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.bible-content {
  line-height: 1.8;
}

.verse-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
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

.verse-number {
  min-width: 20px;
  text-align: right;
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
</style>
