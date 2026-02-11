import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { useBibleStore } from '@/stores/bible'
import { useSentry } from '@/composables/useSentry'
import { BIBLE_CONFIG } from '@/config/app'
import type { SearchResult, BibleVersion, SearchResultDisplay, BibleContent } from '@/types/bible'

interface UseBibleSearchOptions {
  currentVersion:
    | Ref<BibleVersion | undefined | null>
    | ComputedRef<BibleVersion | undefined | null>
  currentBibleContent:
    | Ref<BibleContent | undefined | null>
    | ComputedRef<BibleContent | undefined | null>
  onSearchResultClick: (bookNumber: number, chapter: number, verse: number) => Promise<void>
  isLoadingVerses: Ref<boolean>
}

export function useBibleSearch(options: UseBibleSearchOptions) {
  const { currentVersion, currentBibleContent, onSearchResultClick, isLoadingVerses } = options
  const { reportError } = useSentry()
  const bibleStore = useBibleStore()
  const { searchBibleVerses } = bibleStore

  const searchResults = ref<SearchResult[]>([])
  const isSearchMode = ref(false)
  const searchText = ref('')

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

  const highlightSearchText = (text: string, keyword: string): string => {
    if (!keyword) return text

    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedKeyword})`, 'gi')
    return text.replace(regex, '<mark class="bg-warning">$1</mark>')
  }

  const handleSearch = async (text: string) => {
    const trimmedText = text.trim()
    if (!trimmedText) {
      searchResults.value = []
      isSearchMode.value = false
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
      searchText.value = trimmedText
      const results = await searchBibleVerses(
        trimmedText,
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
    await onSearchResultClick(result.book_number, result.chapter_number, result.verse_number)
  }

  const handleSearchEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ text: string }>
    handleSearch(customEvent.detail.text)
  }

  const handleSelectVerseEvent = async (event: Event) => {
    const customEvent = event as CustomEvent<{ bookNumber: number; chapter: number; verse: number }>
    const { bookNumber, chapter, verse } = customEvent.detail
    isLoadingVerses.value = true
    await onSearchResultClick(bookNumber, chapter, verse)
  }

  const exitSearchMode = () => {
    isSearchMode.value = false
  }

  onMounted(() => {
    window.addEventListener('bible-search', handleSearchEvent)
    window.addEventListener('bible-select-verse', handleSelectVerseEvent)
  })

  onUnmounted(() => {
    window.removeEventListener('bible-search', handleSearchEvent)
    window.removeEventListener('bible-select-verse', handleSelectVerseEvent)
  })

  return {
    searchResults,
    searchResultsDisplay,
    isSearchMode,
    searchText,
    highlightSearchText,
    handleSearch,
    handleSearchResultClick,
    exitSearchMode,
  }
}
