import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import type { BibleContent, BibleVersion, BibleBook } from '@/types/bible'
import type { VerseItem } from '@/types/common'
import { BibleCacheConfig } from '@/types/bible'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useAPI } from '@/composables/useAPI'
import { useLocalStorage } from '@/composables/useLocalStorage'

export const useBibleStore = defineStore('bible', () => {
  const { getLocalItem, setLocalItem, removeLocalItem } = useLocalStorage()
  const { getBibleVersions: fetchBibleVersions, getBibleContent: fetchBibleContent } = useAPI()

  /**
   * Bible versions fetched from API. Cached in memory to avoid duplicate requests.
   */
  const versions = ref<BibleVersion[]>([])
  const versionsLoading = ref(false)
  const versionsLoaded = ref(false)
  let versionsRequest: Promise<BibleVersion[]> | null = null

  /**
   * Map to store in-flight content fetch promises for deduplication
   * Key: version code, Value: Promise<BibleContent>
   */
  const fetchPromises = new Map<string, Promise<BibleContent>>()

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
   * History of verses viewed by the user
   * Array of verses that have been accessed, limited to 50 items
   */
  const historyVerses = ref<VerseItem[]>([])

  /**
   * History lookup map for fast duplicate checking
   * Key: `${bookNumber}-${chapter}-${verse}`
   * Value: index in historyVerses array
   */
  const historyLookupMap = new Map<string, number>()

  /**
   * Currently loaded Bible content in memory
   * Used to avoid redundant IndexedDB reads when the same version is accessed multiple times
   * optimization: use shallowRef as the content is large and handled as an immutable blob
   */
  const currentBibleContent = shallowRef<BibleContent | null>(null)

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
  const currentPassage = ref<import('@/types/bible').BiblePassage | null>(null)

  /**
   * Cached verses for the current preview passage
   */
  const previewVerses = ref<import('@/types/bible').PreviewVerse[]>([])

  /**
   * Cached book metadata for the current preview passage
   */
  const previewBook = ref<BibleBook | null>(null)

  /**
   * Set the preview state
   */
  const setPreviewState = (
    passage: import('@/types/bible').BiblePassage,
    verses: import('@/types/bible').PreviewVerse[],
    book: BibleBook,
  ) => {
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
   * @param verseNumber - The new verse number
   */
  const setCurrentPassageVerse = (verseNumber: number) => {
    if (currentPassage.value) {
      currentPassage.value.verse = verseNumber
    }
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Set error with optional context
   */
  const setError = (message: string) => {
    error.value = message
  }

  /**
   * IndexedDB instance for Bible content cache
   * Stores Bible content by version code for offline access
   */
  const bibleCacheDB = useIndexedDB({
    dbName: BibleCacheConfig.DB_NAME as string,
    version: BibleCacheConfig.DB_VERSION as number,
    stores: [
      {
        name: BibleCacheConfig.STORE_NAME as string,
        keyPath: 'version_code',
      },
    ],
  })

  const versionStorageKey = getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION)
  const secondVersionStorageKey = getStorageKey(
    StorageCategory.BIBLE,
    StorageKey.SECOND_VERSION_CODE,
  )

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

  /**
   * Ensure Bible versions are loaded; fetch from API when needed and update state.
   */
  const loadBibleVersions = async (forceRefresh = false): Promise<BibleVersion[]> => {
    clearError()
    if (versionsLoaded.value && !forceRefresh) {
      return versions.value
    }

    if (versionsLoading.value && versionsRequest) {
      return versionsRequest
    }

    versionsLoading.value = true

    // Key for storing versions in localStorage
    const versionsStorageKey = getStorageKey(StorageCategory.BIBLE, StorageKey.VERSIONS)

    const request = fetchBibleVersions()
      .then((data) => {
        versions.value = data
        versionsLoaded.value = true
        applyVersionSelection(data)
        // Cache versions to localStorage
        setLocalItem(versionsStorageKey, data, 'object')
        return data
      })
      .catch((err) => {
        console.error('Failed to load Bible versions:', err)

        setError('Failed to load versions. Please check your connection.')
        versionsLoaded.value = false
        return [] // Return empty on failure
      })
      .finally(() => {
        versionsLoading.value = false
        versionsRequest = null
      })

    versionsRequest = request

    // Trigger background prefetch (fire and forget)
    request.then(() => {
      startBackgroundPrefetch()
    })

    return request
  }

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

  const enrichContentWithVersion = (content: BibleContent, version: BibleVersion): BibleContent => {
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
   */
  const getCachedBibleContent = async (versionCode: string): Promise<BibleContent | null> => {
    if (currentBibleContent.value?.version_code === versionCode) {
      return currentBibleContent.value
    }

    try {
      const cached = await bibleCacheDB.get<BibleContent>(BibleCacheConfig.STORE_NAME, versionCode)
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
   * Internal helper to fetch and cache version content with request deduplication
   */
  const fetchAndCacheVersion = async (version: BibleVersion): Promise<BibleContent> => {
    // Check for in-flight request
    if (fetchPromises.has(version.code)) {
      console.log(`[BibleStore] Reusing in-flight request for ${version.code}`)
      return fetchPromises.get(version.code)!
    }

    const promise = (async () => {
      try {
        const content = await fetchBibleContent(version.id)
        // Enrich and cache
        const contentToPersist = enrichContentWithVersion(content, version)
        await bibleCacheDB.put<BibleContent>(BibleCacheConfig.STORE_NAME, contentToPersist)
        return contentToPersist
      } finally {
        fetchPromises.delete(version.code)
      }
    })()

    fetchPromises.set(version.code, promise)
    return promise
  }

  /**
   * Get Bible content, auto fetching from API when cache is missing or forceRefresh is true.
   */
  const getBibleContent = async (
    versionCode: string,
    options: { forceRefresh?: boolean; useCacheOnly?: boolean } = {},
  ): Promise<BibleContent | null> => {
    clearError()
    const { forceRefresh = false, useCacheOnly = false } = options

    if (!forceRefresh) {
      const cached = await getCachedBibleContent(versionCode)
      if (cached) {
        return cached
      }
      if (useCacheOnly) {
        return null
      }
    }

    try {
      // Ensure versions are loaded to get metadata
      if (!versionsLoaded.value || versions.value.length === 0) {
        await loadBibleVersions()
      }

      const version = versions.value.find((v) => v.code === versionCode)
      if (!version) {
        // This can happen if API call failed or versionCode is invalid
        throw new Error(`Bible version metadata for code ${versionCode} not found.`)
      }

      // Use the deduplicated fetch helper
      const content = await fetchAndCacheVersion(version)

      // Update current content if this is still the requested version
      // (Though usually the component handles race conditions, checking here is safe)
      currentBibleContent.value = content

      return content
    } catch (err) {
      console.error(`Failed to get or cache content for ${versionCode}:`, err)
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred while fetching content.'
      setError(errorMessage)
      return null
    }
  }

  /**
   * Prefetch a specific version and cache it without updating the current view
   * @param version - The version to prefetch
   */
  /**
   * Prefetch a specific version and cache it without updating the current view
   * Auto-updates if the server version is newer than the cached version
   * @param version - The version to prefetch
   */
  const prefetchVersion = async (version: BibleVersion) => {
    try {
      const cached = await bibleCacheDB.get<BibleContent>(BibleCacheConfig.STORE_NAME, version.code)
      if (cached && cached.updated_at === version.updated_at) {
        return
      }
      await fetchAndCacheVersion(version)
    } catch (err) {
      console.warn(`[Background] Failed to prefetch/update version ${version.code}:`, err)
    }
  }

  /**
   * Start background prefetching of all available versions
   * Runs sequentially to avoid network congestion
   */
  const startBackgroundPrefetch = async () => {
    if (!versions.value || versions.value.length === 0) return

    for (const version of versions.value) {
      await prefetchVersion(version)
    }
  }

  /**
   * Clear the currently loaded Bible content from memory
   * Useful when switching versions to free up memory
   */
  const clearCurrentBibleContent = () => {
    currentBibleContent.value = null
  }

  /**
   * Check if the Bible content for a specific version is cached
   * @param versionCode - version code
   * @returns true if cached, false otherwise
   */
  const hasCachedContent = async (versionCode: string): Promise<boolean> => {
    if (currentBibleContent.value?.version_code === versionCode) {
      return true
    }
    try {
      return await bibleCacheDB.has(BibleCacheConfig.STORE_NAME, versionCode)
    } catch (err) {
      console.error('Failed to check cache:', err)
      setError('Failed to check cache status.')
      return false
    }
  }

  /**
   * Generate lookup key for verse
   */
  const getVerseKey = (verse: VerseItem): string => {
    return `${verse.bookNumber}-${verse.chapter}-${verse.verse}`
  }

  /**
   * Rebuild lookup map from current history
   * Useful when history is loaded from storage or modified externally
   */
  const rebuildHistoryLookupMap = () => {
    historyLookupMap.clear()
    historyVerses.value.forEach((item, index) => {
      const key = getVerseKey(item)
      historyLookupMap.set(key, index)
    })
  }

  /**
   * Add verse to history with optimized duplicate checking
   * @param verse - The verse to add to history
   */
  const addToHistory = (verse: VerseItem) => {
    const verseKey = getVerseKey(verse)

    // Fast duplicate check using Map
    if (historyLookupMap.has(verseKey)) {
      return
    }

    // Add to history
    historyVerses.value.unshift(verse)

    // Update lookup map: shift all existing indices by 1
    const entries = Array.from(historyLookupMap.entries())
    historyLookupMap.clear()
    historyLookupMap.set(verseKey, 0)
    entries.forEach(([key, index]) => {
      historyLookupMap.set(key, index + 1)
    })

    // Limit the history record count (maximum 50 records)
    if (historyVerses.value.length > 50) {
      const removed = historyVerses.value.pop()
      if (removed) {
        const removedKey = getVerseKey(removed)
        historyLookupMap.delete(removedKey)
      }
    }
  }

  /**
   * Remove a verse from history by ID
   * @param id - The verse ID to remove
   */
  const removeHistoryItem = (id: string) => {
    const index = historyVerses.value.findIndex((item) => item.id === id)
    if (index === -1) return

    const removed = historyVerses.value[index]
    if (!removed) return

    historyVerses.value.splice(index, 1)

    rebuildHistoryLookupMap()
  }

  /**
   * Clear all history
   */
  const clearHistory = () => {
    historyVerses.value = []
    historyLookupMap.clear()
  }

  /**
   * Set the selected verse (for component communication)
   * @param bookNumber - Book number
   * @param chapter - Chapter number
   * @param verse - Verse number
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

  return {
    // Version management
    versions,
    versionsLoading,
    currentVersion,
    loadBibleVersions,
    setCurrentVersionByCode,
    getVersionByCode,
    isMultiVersion,
    secondVersionCode,
    // Bible Content Cache
    currentBibleContent,
    getBibleContent,
    getCachedBibleContent,
    hasCachedContent,
    clearCurrentBibleContent,
    // History Management
    historyVerses,
    addToHistory,
    removeHistoryItem,
    clearHistory,
    // Error state
    error,
    clearError,
    setError,
    // Verse selection (for component communication)
    selectedVerse,
    setSelectedVerse,
    clearSelectedVerse,
    // Preview State (Persistent across views)
    currentPassage,
    previewVerses,
    previewBook,
    setPreviewState,
    setCurrentPassageVerse,
    clearPreviewState,
  }
})
