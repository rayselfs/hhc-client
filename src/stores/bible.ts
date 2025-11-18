import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BibleContent, BibleVersion } from '@/types/bible'
import type { VerseItem } from '@/types/common'
import { BibleCacheConfig } from '@/types/bible'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useAPI } from '@/composables/useAPI'
import { useLocalStorage } from '@/composables/useLocalStorage'

export const useBibleStore = defineStore('bible', () => {
  const { getLocalItem } = useLocalStorage()
  const { getBibleVersions: fetchBibleVersions, getBibleContent: fetchBibleContent } = useAPI()

  /**
   * Bible versions fetched from API. Cached in memory to avoid duplicate requests.
   */
  const versions = ref<BibleVersion[]>([])
  const versionsLoading = ref(false)
  const versionsLoaded = ref(false)
  let versionsRequest: Promise<BibleVersion[]> | null = null

  /**
   * Current selected Bible version. Persisted to localStorage for reuse.
   */
  const currentVersion = ref<BibleVersion | null>(null)

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
   */
  const currentBibleContent = ref<BibleContent | null>(null)

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
   * Stores Bible content by version ID for offline access
   */
  const bibleCacheDB = useIndexedDB({
    dbName: BibleCacheConfig.DB_NAME as string,
    version: BibleCacheConfig.DB_VERSION as number,
    stores: [
      {
        name: BibleCacheConfig.STORE_NAME as string,
        keyPath: 'version_id',
      },
    ],
  })

  const versionStorageKey = getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION)

  /**
   * Persist the currently selected version to localStorage or clear it when null.
   */
  const persistCurrentVersion = (version: BibleVersion | null) => {
    if (typeof window === 'undefined') return
    if (version) {
      window.localStorage.setItem(versionStorageKey, JSON.stringify(version))
    } else {
      window.localStorage.removeItem(versionStorageKey)
    }
  }

  /**
   * Retrieve a version from the in-memory list by version ID.
   */
  const getVersionById = (versionId: number | null): BibleVersion | null => {
    if (versionId == null) {
      return null
    }
    return versions.value.find((version) => version.id === versionId) ?? null
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
   * Update the current version by ID; clears the selection if no match is found.
   */
  const setCurrentVersionById = (versionId: number | null) => {
    if (versionId == null) {
      setCurrentVersionInternal(null, true)
      return
    }
    const target = getVersionById(versionId)
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

    const storedVersionId =
      currentVersion.value?.id ??
      getLocalItem<BibleVersion>(versionStorageKey, 'object')?.id ??
      fallbackVersion.id

    const matchedVersion =
      availableVersions.find((version) => version.id === storedVersionId) ?? fallbackVersion

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
    const request = fetchBibleVersions()
      .then((data) => {
        versions.value = data
        versionsLoaded.value = true
        applyVersionSelection(data)
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
    return request
  }

  // Initialize current version from storage if available
  currentVersion.value = getLocalItem<BibleVersion>(versionStorageKey, 'object') ?? null

  // --- START: Issue 1 Fix ---
  const enrichContentWithVersion = (
    content: BibleContent,
    version: BibleVersion, // <-- CHANGED
  ): BibleContent => {
    // const version = currentVersion.value // <-- REMOVED
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
    }
  }

  /**
   * Save Bible content to IndexedDB and update cache
   */
  const cacheBibleContent = async (content: BibleContent, version: BibleVersion): Promise<void> => {
    const contentToPersist = enrichContentWithVersion(content, version)
    try {
      await bibleCacheDB.put<BibleContent>(BibleCacheConfig.STORE_NAME, contentToPersist)
      currentBibleContent.value = contentToPersist
    } catch (err) {
      console.error('Failed to cache Bible content:', err)
      setError('Failed to save content to offline cache.')
    }
  }

  /**
   * Get Bible content from in-memory cache or IndexedDB without fetching from API.
   */
  const getCachedBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    if (currentBibleContent.value?.version_id === versionId) {
      return currentBibleContent.value
    }

    try {
      const cached = await bibleCacheDB.get<BibleContent>(BibleCacheConfig.STORE_NAME, versionId)
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
   * Get Bible content, auto fetching from API when cache is missing or forceRefresh is true.
   */
  const getBibleContent = async (
    versionId: number,
    options: { forceRefresh?: boolean; useCacheOnly?: boolean } = {},
  ): Promise<BibleContent | null> => {
    clearError()
    const { forceRefresh = false, useCacheOnly = false } = options

    if (!forceRefresh) {
      const cached = await getCachedBibleContent(versionId)
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

      const version = getVersionById(versionId)
      if (!version) {
        // This can happen if API call failed or versionId is invalid
        throw new Error(`Bible version metadata for ID ${versionId} not found.`)
      }

      const content = await fetchBibleContent(versionId)
      await cacheBibleContent(content, version)
      return currentBibleContent.value
    } catch (err) {
      console.error(`Failed to get or cache content for ${versionId}:`, err)
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred while fetching content.'
      setError(errorMessage)
      return null
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
   * @param versionId - version ID
   * @returns true if cached, false otherwise
   */
  const hasCachedContent = async (versionId: number): Promise<boolean> => {
    if (currentBibleContent.value?.version_id === versionId) {
      return true
    }
    try {
      return await bibleCacheDB.has(BibleCacheConfig.STORE_NAME, versionId)
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
    setCurrentVersionById,
    getVersionById,
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
  }
})
