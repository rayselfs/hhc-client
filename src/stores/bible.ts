import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import type {
  BibleContent,
  BibleVersion,
  BibleBook,
  SearchResult,
  BibleVerseIndexItem,
  BibleSearchIndexData,
  BiblePassage,
  PreviewVerse,
} from '@/types/bible'
import type { VerseItem } from '@/types/common'
import { BibleCacheConfig } from '@/types/bible'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { BIBLE_CONFIG } from '@/config/app'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useAPI } from '@/composables/useAPI'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useFlexSearch, type FlexSearchConfig } from '@/composables/useFlexSearch'
import { useSentry } from '@/composables/useSentry'

export const useBibleStore = defineStore('bible', () => {
  const { getLocalItem, setLocalItem, removeLocalItem } = useLocalStorage()
  const { getBibleVersions: getBibleVersionsAPI, getBibleContent: getBibleContentAPI } = useAPI()

  // ==================== State Declarations ====================

  /**
   * Bible versions fetched from API. Cached in memory to avoid duplicate requests.
   */
  const versions = ref<BibleVersion[]>([])

  /**
   * Loading state for Bible versions
   */
  const versionsLoading = ref(false)

  /**
   * Initialized application loaded versions state
   */
  const initializedVersionsLoaded = ref(false)

  /**
   * Current selected Bible version. Persisted to localStorage for reuse.
   */
  const currentVersion = ref<BibleVersion | null>(null)

  /**
   * Multi-version mode state
   */
  const isMultiVersion = ref(false)
  const secondVersionCode = ref<string | null>(null)

  /**
   * Currently loaded Bible content in memory
   * Used to avoid redundant IndexedDB reads when the same version is accessed multiple times
   * optimization: use shallowRef as the content is large and handled as an immutable blob
   */
  const currentBibleContent = shallowRef<BibleContent | null>(null)

  /**
   * Currently loaded search index version code in memory
   * Tracks which version's search index is currently loaded in the FlexSearch instance
   * Similar to currentBibleContent, but for search index state tracking
   */
  const currentSearchIndex = ref<string | null>(null)

  /**
   * History of verses viewed by the user
   * Array of verses that have been accessed, limited to 50 items
   */
  const historyVerses = ref<VerseItem[]>([])

  /**
   * Stores error messages from async operations
   */
  const error = ref<string | null>(null)

  /**
   * Currently selected verse for component communication
   * Used to notify components when a verse is selected
   */
  const selectedVerse = ref<{
    bookNumber: number
    chapter: number
    verse: number
  } | null>(null)

  /**
   * Current selected passage for Preview
   * Persisted in store to survive view changes
   */
  const currentPassage = ref<BiblePassage | null>(null)

  /**
   * Cached verses for the current preview passage
   */
  const previewVerses = ref<PreviewVerse[]>([])

  /**
   * Cached book metadata for the current preview passage
   */
  const previewBook = ref<BibleBook | null>(null)

  /**
   * Map to store in-flight content fetch promises for deduplication
   * Key: version code, Value: Promise<BibleContent>
   */
  const fetchPromises = new Map<string, Promise<BibleContent>>()

  /**
   * Map to store in-flight search index fetch promises for deduplication
   * Key: version code, Value: Promise<BibleSearchIndexData>
   */
  const fetchSearchIndexPromises = new Map<string, Promise<BibleSearchIndexData>>()

  /**
   * Loading state for search index
   */
  const isIndexing = ref(false)

  /**
   * IndexedDB instance for Bible content cache
   * Stores Bible content by version code for offline access
   */
  const bibleIndexedDB = useIndexedDB({
    dbName: BibleCacheConfig.DB_NAME as string,
    version: BibleCacheConfig.DB_VERSION as number,
    stores: [
      {
        name: BibleCacheConfig.STORE_NAME as string,
        keyPath: 'version_code',
      },
      {
        name: BibleCacheConfig.SEARCH_INDEX_STORE_NAME as string,
        keyPath: 'version_code',
      },
    ],
  })

  /**
   * FlexSearch instance for Bible verse search
   */
  const {
    indexDocuments,
    search: flexSearch,
    getDocumentCount,
    updateOptions,
    reset,
  } = useFlexSearch<BibleVerseIndexItem>({
    searchFields: ['text'],
    idField: 'verse_id',
    options: {
      tokenize: 'full',
      resolution: 9,
      threshold: 1,
      depth: 3,
      context: true,
    },
  })

  // FlexSearch configuration for different languages
  const CHINESE_OPTIONS: FlexSearchConfig<BibleVerseIndexItem>['options'] = {
    tokenize: 'full', // Index all substrings for better fuzzy matching in Chinese
    resolution: 9,
    threshold: 1,
    depth: 3,
    context: true,
    encode: false,
  }

  const ENGLISH_OPTIONS: FlexSearchConfig<BibleVerseIndexItem>['options'] = {
    tokenize: 'full',
    resolution: 9,
    threshold: 1,
    depth: 3,
    context: true,
  }

  // ==================== Storage Keys ====================

  const versionStorageKey = getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION)
  const secondVersionStorageKey = getStorageKey(
    StorageCategory.BIBLE,
    StorageKey.SECOND_VERSION_CODE,
  )

  // Initialize current version from storage if available
  currentVersion.value = getLocalItem<BibleVersion>(versionStorageKey, 'object') ?? null

  // Initialize multi-version state
  isMultiVersion.value = false
  secondVersionCode.value = getLocalItem<string>(secondVersionStorageKey) ?? null

  watch(secondVersionCode, (val) => {
    if (val) {
      setLocalItem(secondVersionStorageKey, val)
    } else {
      removeLocalItem(secondVersionStorageKey)
    }
  })

  // ==================== Version Management ====================

  /**
   * Persist the currently selected version to localStorage or clear it when null.
   */
  const persistCurrentVersion = (version: BibleVersion | null) => {
    if (typeof window === 'undefined') return
    if (version) {
      setLocalItem(versionStorageKey, version, 'object')
    } else {
      removeLocalItem(versionStorageKey)
    }
  }

  /**
   * Retrieve a version from the in-memory list by version code.
   */
  const getVersionByCode = (versionCode: string | null): BibleVersion | null => {
    if (versionCode == null) {
      return null
    }
    return versions.value.find((version) => version.code === versionCode) ?? null
  }

  /**
   * Set the current version, optionally persisting to localStorage and resetting caches.
   */
  const setCurrentVersionInternal = (version: BibleVersion | null, persist = true) => {
    const previousId = currentVersion.value?.id
    currentVersion.value = version ?? null
    if (persist) {
      persistCurrentVersion(version ?? null)
    }

    if (previousId !== currentVersion.value?.id) {
      clearCurrentBibleContent()
      clearCurrentSearchIndex()

      // Preload search index for the new version in the background
      if (version?.code) {
        // Initializing search options based on language
        if (version.code.startsWith('CUNP')) {
          updateOptions(CHINESE_OPTIONS)
        } else {
          updateOptions(ENGLISH_OPTIONS)
        }

        setTimeout(() => {
          fetchSearchIndex(version).catch((err) => {
            console.warn(`Failed to preload search index for ${version.code}:`, err)
          })
        }, 0)
      }
    }
  }

  /**
   * Update the current version by code; clears the selection if no match is found.
   */
  const setCurrentVersionByCode = (versionCode: string | null) => {
    if (versionCode == null) {
      setCurrentVersionInternal(null, true)
      return
    }
    const target = getVersionByCode(versionCode)
    setCurrentVersionInternal(target ?? null, true)
  }

  /**
   * Apply the best available version from the loaded list, preferring stored preferences.
   */
  const applyVersionSelection = (availableVersions: BibleVersion[]) => {
    if (availableVersions.length === 0) {
      setCurrentVersionInternal(null, true)
      return
    }

    const fallbackVersion = availableVersions[0]
    if (!fallbackVersion) {
      setCurrentVersionInternal(null, true)
      return
    }

    const storedVersionCode =
      currentVersion.value?.code ??
      getLocalItem<BibleVersion>(versionStorageKey, 'object')?.code ??
      fallbackVersion.code

    const matchedVersion =
      availableVersions.find((version) => version.code === storedVersionCode) ?? fallbackVersion

    setCurrentVersionInternal(matchedVersion, true)
  }

  // ==================== Content Management ====================

  /**
   * Merge version metadata into Bible content
   */
  const mergeVersionInfoToContent = (
    content: BibleContent,
    version: BibleVersion,
  ): BibleContent => {
    if (!version) {
      return content
    }

    if (
      content.version_id === version.id &&
      content.version_code === version.code &&
      content.version_name === version.name
    ) {
      return content
    }

    return {
      ...content,
      version_id: version.id,
      version_code: version.code,
      version_name: version.name,
      updated_at: version.updated_at,
    }
  }

  /**
   * Get Bible content from in-memory cache or IndexedDB without fetching from API.
   * Internal helper function.
   */
  const getCachedBibleContent = async (versionCode: string): Promise<BibleContent | null> => {
    if (currentBibleContent.value?.version_code === versionCode) {
      return currentBibleContent.value
    }

    try {
      const cached = await bibleIndexedDB.get<BibleContent>(
        BibleCacheConfig.STORE_NAME,
        versionCode,
      )
      if (cached) {
        currentBibleContent.value = cached
        return cached
      }
    } catch (err) {
      console.error('Failed to get cached content:', err)
      setError('Failed to read from offline cache.')
    }

    currentBibleContent.value = null
    return null
  }

  /**
   * Fetch and cache bible content with request deduplication
   * Internal helper function.
   * Note: This function assumes cache check has already been done by getCachedBibleContent.
   */
  const fetchBibleContent = async (version: BibleVersion): Promise<BibleContent> => {
    if (fetchPromises.has(version.code)) {
      return fetchPromises.get(version.code)!
    }

    const cachedContent = await getCachedBibleContent(version.code)
    if (cachedContent && cachedContent.updated_at === version.updated_at) {
      return cachedContent
    }

    console.log('Fetching Bible content for version ID:', version.id)
    const promise = (async () => {
      try {
        const content = await getBibleContentAPI(version.id)
        const contentWithVersion = mergeVersionInfoToContent(content, version)
        await bibleIndexedDB.put<BibleContent>(BibleCacheConfig.STORE_NAME, contentWithVersion)
        return contentWithVersion
      } finally {
        fetchPromises.delete(version.code)
      }
    })()

    fetchPromises.set(version.code, promise)
    return promise
  }

  /**
   * Get Bible content, auto fetching from API when cache is missing or forceRefresh is true.
   * Public API - unified entry point for getting Bible content.
   */
  const getBibleContent = async (versionCode: string): Promise<BibleContent> => {
    clearError()

    const cached = await getCachedBibleContent(versionCode)
    if (cached) {
      return cached
    }

    const version = versions.value.find((v) => v.code === versionCode)
    if (!version) {
      throw new Error(`Bible version metadata for code ${versionCode} not found.`)
    }

    const content = await fetchBibleContent(version)
    currentBibleContent.value = content

    return content
  }

  /**
   * Clear the currently loaded Bible content from memory
   * Useful when switching versions to free up memory
   */
  const clearCurrentBibleContent = () => {
    currentBibleContent.value = null
  }

  // ==================== Search Index Management ====================

  /**
   * Build search index from Bible content
   * Internal helper function.
   */
  const buildSearchIndex = async (content: BibleContent): Promise<BibleSearchIndexData> => {
    const indexItems: BibleVerseIndexItem[] = []

    for (const book of content.books) {
      for (const chapter of book.chapters) {
        for (const verse of chapter.verses) {
          indexItems.push({
            verse_id: `${content.version_code}-${book.number}-${chapter.number}-${verse.number}`,
            version_code: content.version_code,
            book_number: book.number,
            chapter_number: chapter.number,
            verse_number: verse.number,
            text: verse.text,
          })
        }
      }
    }

    if (indexItems.length > 0) {
      // Force reset worker before building large index to ensure clean state
      // This mimics "Restart App" behavior which solves the timeout issue
      reset()

      await indexDocuments(indexItems)
      currentSearchIndex.value = content.version_code
    }

    return {
      version_code: content.version_code,
      documents_data: indexItems,
      updated_at: content.updated_at,
    }
  }

  /**
   * Get search index from in-memory cache or IndexedDB without building from content
   * Internal helper function.
   */
  const getCachedSearchIndex = async (versionCode: string, updatedAt: number): Promise<boolean> => {
    // If the same version is already loaded in memory, return true
    if (currentSearchIndex.value === versionCode && getDocumentCount() > 0) {
      return true
    }

    try {
      const cached = await bibleIndexedDB.get<BibleSearchIndexData>(
        BibleCacheConfig.SEARCH_INDEX_STORE_NAME,
        versionCode,
      )

      if (cached && cached.updated_at === updatedAt && cached.documents_data) {
        await indexDocuments(cached.documents_data)
        currentSearchIndex.value = versionCode
        return true
      }
      currentSearchIndex.value = null
      return false
    } catch (err) {
      console.warn(`Failed to get cached search index for ${versionCode}:`, err)
      currentSearchIndex.value = null
      return false
    }
  }

  /**
   * Prefetch search index for a specific version
   * Internal helper function.
   */
  const fetchSearchIndex = async (version: BibleVersion): Promise<BibleSearchIndexData> => {
    if (fetchSearchIndexPromises.has(version.code)) {
      return fetchSearchIndexPromises.get(version.code)!
    }

    const cachedIndex = await bibleIndexedDB.get<BibleSearchIndexData>(
      BibleCacheConfig.SEARCH_INDEX_STORE_NAME,
      version.code,
    )
    if (cachedIndex && cachedIndex.updated_at === version.updated_at) {
      return cachedIndex
    }

    console.log('Building search index for version ID:', version.id)
    const promise = (async () => {
      try {
        const content = await getBibleContent(version.code)
        const index = await buildSearchIndex(content)
        await bibleIndexedDB.put(BibleCacheConfig.SEARCH_INDEX_STORE_NAME, index)
        return index
      } finally {
        fetchSearchIndexPromises.delete(version.code)
      }
    })()

    fetchSearchIndexPromises.set(version.code, promise)
    return promise
  }

  /**
   * Get search index, auto building from content when cache is missing
   * Internal helper function.
   */
  const getSearchIndex = async (versionCode: string): Promise<boolean> => {
    const version = versions.value.find((v) => v.code === versionCode)
    if (!version) {
      return false
    }

    // Try to get cached index first (loads into memory if valid)
    const cached = await getCachedSearchIndex(versionCode, version.updated_at)
    if (cached) {
      return true
    }

    await fetchSearchIndex(version)
    return currentSearchIndex.value === versionCode
  }

  /**
   * Search Bible verses using FlexSearch
   * Public API - unified entry point for searching Bible verses.
   */
  const searchBibleVerses = async (
    query: string,
    versionCode: string,
    limit: number = BIBLE_CONFIG.SEARCH.DEFAULT_RESULT_LIMIT,
  ): Promise<SearchResult[]> => {
    try {
      // Ensure index is loaded (similar to how getBibleContent works)
      const indexAvailable = await getSearchIndex(versionCode)
      if (!indexAvailable) {
        console.warn(`Search index not available for version: ${versionCode}`)
        setError(`Search index not available for version ${versionCode}. Please try again.`)
        return []
      }

      // Perform search
      const flexResults = await flexSearch(query.trim(), limit)

      // Convert FlexSearch results to SearchResult format
      return flexResults.map((result) => ({
        score: result.score || 0,
        verse_id: result.item.verse_id,
        version_code: result.item.version_code,
        book_number: result.item.book_number,
        chapter_number: result.item.chapter_number,
        verse_number: result.item.verse_number,
        text: result.item.text,
      }))
    } catch (err) {
      console.error(`Failed to search Bible verses:`, err)
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred while searching.'
      setError(errorMessage)
      return []
    }
  }

  /**
   * Clear the currently loaded search index from memory
   * Useful when switching versions to free up memory
   */
  const clearCurrentSearchIndex = () => {
    currentSearchIndex.value = null
  }

  // ==================== History Management ====================

  /**
   * Add verse to history with optimized duplicate checking
   */
  const addToHistory = (verse: VerseItem) => {
    // Check for duplicates
    const existingIndex = historyVerses.value.findIndex(
      (item) =>
        item.bookNumber === verse.bookNumber &&
        item.chapter === verse.chapter &&
        item.verse === verse.verse,
    )

    if (existingIndex !== -1) {
      // If exists, remove it first so we can move it to the top
      historyVerses.value.splice(existingIndex, 1)
    }

    // Add to top of history
    historyVerses.value.unshift(verse)

    // Limit the history record count
    if (historyVerses.value.length > BIBLE_CONFIG.VERSE.MAX_HISTORY_ITEMS) {
      historyVerses.value.pop()
    }
  }

  /**
   * Remove a verse from history by ID
   */
  const removeHistoryItem = (id: string) => {
    const index = historyVerses.value.findIndex((item) => item.id === id)
    if (index !== -1) {
      historyVerses.value.splice(index, 1)
    }
  }

  /**
   * Clear all history
   */
  const clearHistory = () => {
    historyVerses.value = []
  }

  // ==================== Preview Management ====================

  /**
   * Set the preview state
   */
  const setPreviewState = (passage: BiblePassage, verses: PreviewVerse[], book: BibleBook) => {
    currentPassage.value = passage
    previewVerses.value = verses
    previewBook.value = book
  }

  /**
   * Clear the preview state
   */
  const clearPreviewState = () => {
    currentPassage.value = null
    previewVerses.value = []
    previewBook.value = null
  }

  /**
   * Update the verse number of the current passage
   */
  const setCurrentPassageVerse = (verseNumber: number) => {
    if (currentPassage.value) {
      currentPassage.value.verse = verseNumber
    }
  }

  // ==================== Error Management ====================

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Set error with optional context and report to Sentry
   */
  const setError = (message: string, err?: unknown) => {
    error.value = message
    console.error(message, err)

    if (err) {
      const { reportError } = useSentry()
      reportError(err, {
        component: 'BibleStore',
        operation: 'setError',
        extra: { message },
      })
    }
  }

  // ==================== Initialization & Background Prefetch ====================

  /**
   * Start background prefetching of all available versions
   * Uses concurrent execution with controlled parallelism for better performance
   */
  const startBackgroundPrefetch = async () => {
    if (!versions.value || versions.value.length === 0) {
      console.error('No versions available to prefetch.')
      return
    }

    // Prioritize current version, then fetch others sequentially
    // This sorting ensures the user gets their selected version first,
    // while the sequential loop prevents Electron IPC race conditions.
    const current = currentVersion.value
    const orderedVersions = [
      ...(current ? [current] : []),
      ...versions.value.filter((v) => v.code !== current?.code),
    ]

    for (const version of orderedVersions) {
      try {
        isIndexing.value = true
        await fetchBibleContent(version)
        await fetchSearchIndex(version)
        isIndexing.value = false
      } catch (err) {
        console.warn(`Failed to prefetch version ${version.code}:`, err)
      }
    }
  }

  /**
   * Initialize the Bible store by loading versions, content, and search index.
   */
  const initializeBibleStore = async () => {
    if (initializedVersionsLoaded.value && versions.value.length > 0) {
      return
    }

    versionsLoading.value = true
    const versionsStorageKey = getStorageKey(StorageCategory.BIBLE, StorageKey.VERSIONS)
    getBibleVersionsAPI()
      .then((data) => {
        versions.value = data
        initializedVersionsLoaded.value = true
        applyVersionSelection(data)
        setLocalItem(versionsStorageKey, data, 'object')
        return data
      })
      .catch((err) => {
        console.error('Failed to load Bible versions:', err)
        setError('Failed to load versions. Please check your connection.')
        initializedVersionsLoaded.value = false
      })
      .finally(() => {
        versionsLoading.value = false
        startBackgroundPrefetch()
      })
  }

  // ==================== Verse Selection (Component Communication) ====================

  /**
   * Set the selected verse (for component communication)
   */
  const setSelectedVerse = (bookNumber: number, chapter: number, verse: number) => {
    selectedVerse.value = { bookNumber, chapter, verse }
  }

  /**
   * Clear the selected verse
   */
  const clearSelectedVerse = () => {
    selectedVerse.value = null
  }

  // ==================== Public API ====================

  return {
    // Version management
    versions,
    currentVersion,
    versionsLoading,
    initializedVersionsLoaded,
    error,
    currentBibleContent,
    isMultiVersion,
    secondVersionCode,

    // Methods
    initializeBibleStore,
    setCurrentVersionByCode,
    getBibleContent,
    searchBibleVerses,
    isIndexing,

    // History
    historyVerses,
    addToHistory,
    removeHistoryItem,
    clearHistory,

    // Preview
    currentPassage,
    previewVerses,
    previewBook,
    setPreviewState,
    clearPreviewState,
    setCurrentPassageVerse,

    // Selection
    selectedVerse,
    setSelectedVerse,
    clearSelectedVerse,
  }
})
