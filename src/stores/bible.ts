import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BibleContent, BibleVersion } from '@/types/bible'
import type { VerseItem } from '@/types/common'
import { BibleCacheConfig } from '@/types/bible'
import { APP_CONFIG } from '@/config/app'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useAPI } from '@/composables/useAPI'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useFolderStore } from './folder'

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
   * Currently loaded Bible content in memory
   * Used to avoid redundant IndexedDB reads when the same version is accessed multiple times
   */
  const currentBibleContent = ref<BibleContent | null>(null)

  /**
   * Stores error messages from async operations
   */
  const error = ref<string | null>(null) // <-- ADDED (Issue 2)

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
    error.value = null // <-- ADDED (Issue 2)
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
        // <-- ADDED (Issue 2)
        console.error('Failed to load Bible versions:', err)
        error.value = 'Failed to load versions. Please check your connection.'
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
  const cacheBibleContent = async (
    content: BibleContent,
    version: BibleVersion, // <-- CHANGED
  ): Promise<void> => {
    const contentToPersist = enrichContentWithVersion(content, version) // <-- Pass correct version
    try {
      // <-- ADDED (Issue 2)
      await bibleCacheDB.put<BibleContent>(BibleCacheConfig.STORE_NAME, contentToPersist)
      currentBibleContent.value = contentToPersist
    } catch (err) {
      console.error('Failed to cache Bible content:', err)
      error.value = 'Failed to save content to offline cache.'
    }
  }
  // --- END: Issue 1 Fix ---

  /**
   * Get Bible content from in-memory cache or IndexedDB without fetching from API.
   */
  const getCachedBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    if (currentBibleContent.value?.version_id === versionId) {
      return currentBibleContent.value
    }

    try {
      // <-- ADDED (Issue 2)
      const cached = await bibleCacheDB.get<BibleContent>(BibleCacheConfig.STORE_NAME, versionId)
      if (cached) {
        currentBibleContent.value = cached
        return cached
      }
    } catch (err) {
      console.error('Failed to get cached content:', err)
      error.value = 'Failed to read from offline cache.'
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
    error.value = null // <-- ADDED (Issue 2)
    const { forceRefresh = false, useCacheOnly = false } = options

    if (!forceRefresh) {
      const cached = await getCachedBibleContent(versionId) // This now has try/catch
      if (cached) {
        return cached
      }
      if (useCacheOnly) {
        return null
      }
    }

    // --- START: Issue 1 & 2 Fix ---
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
      await cacheBibleContent(content, version) // Pass the correct version
      return currentBibleContent.value
    } catch (err) {
      console.error(`Failed to get or cache content for ${versionId}:`, err)
      error.value =
        err instanceof Error ? err.message : 'An unknown error occurred while fetching content.'
      return null
    }
    // --- END: Issue 1 & 2 Fix ---
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
      // <-- ADDED (Issue 2)
      return await bibleCacheDB.has(BibleCacheConfig.STORE_NAME, versionId)
    } catch (err) {
      console.error('Failed to check cache:', err)
      error.value = 'Failed to check cache status.'
      return false
    }
  }

  /**
   * Add verse to history
   * @param verse - The verse to add to history
   */
  const addToHistory = (verse: VerseItem) => {
    const latestHistory = historyVerses.value[0]
    const existingIndex = historyVerses.value.findIndex(
      (item) =>
        item.bookNumber === verse.bookNumber &&
        item.chapter === verse.chapter &&
        item.verse === verse.verse,
    )
    if (
      (latestHistory &&
        latestHistory.bookNumber === verse.bookNumber &&
        latestHistory.chapter === verse.chapter) ||
      existingIndex !== -1
    ) {
      return
    }

    historyVerses.value.unshift(verse)

    // Limit the history record count (maximum 50 records)
    if (historyVerses.value.length > 50) {
      historyVerses.value.pop()
    }
  }

  /**
   * Remove a verse from history by ID
   * @param id - The verse ID to remove
   */
  const removeHistoryItem = (id: string) => {
    historyVerses.value = historyVerses.value.filter((item) => item.id !== id)
  }

  /**
   * Clear all history
   */
  const clearHistory = () => {
    historyVerses.value = []
  }

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
    // Folder Store (re-export for convenience)
    folderStore,
    // Bible-specific folder operations
    addVerseToCurrent,
    // Error state
    error,
  }
})
