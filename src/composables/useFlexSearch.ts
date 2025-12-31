import { ref, type Ref } from 'vue'
import FlexSearch from 'flexsearch'

/**
 * Generic configuration for FlexSearch index
 */
export interface FlexSearchConfig<T> {
  /** Fields to index for searching */
  searchFields: (keyof T)[]
  /** Unique ID field for documents */
  idField: keyof T
  /** Additional FlexSearch options */
  options?: {
    tokenize?: 'strict' | 'forward' | 'reverse' | 'full'
    threshold?: number
    resolution?: number
    depth?: number
    bidirectional?: boolean
    cache?: boolean
    worker?: boolean
  }
}

/**
 * Search result with score
 */
export interface FlexSearchResult<T> {
  item: T
  score?: number
}

/**
 * Generic FlexSearch composable for full-text searching
 *
 * @example
 * ```ts
 * const { index, search, clear } = useFlexSearch<BibleVerse>({
 *   searchFields: ['text', 'reference'],
 *   idField: 'id'
 * })
 *
 * index(verses)
 * const results = await search('love')
 * ```
 */
export function useFlexSearch<T extends Record<string, unknown>>(config: FlexSearchConfig<T>) {
  const { searchFields, idField, options = {} } = config

  // Use Document index for multi-field searching
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flexIndex = ref<any>(null)
  const documents = ref<Map<string | number, T>>(new Map())
  const isIndexing = ref(false)
  const isSearching = ref(false)

  /**
   * Initialize the FlexSearch index
   */
  const initializeIndex = () => {
    if (flexIndex.value) return

    // Create document index with specified fields
    flexIndex.value = new FlexSearch.Document({
      tokenize: options.tokenize || 'forward',
      resolution: options.resolution || 9,
      document: {
        id: idField as string,
        index: searchFields as string[],
      },
    })
  }

  /**
   * Add documents to the index
   * @param items - Array of items to index
   */
  const indexDocuments = async (items: T[]) => {
    if (!items || items.length === 0) return

    isIndexing.value = true

    try {
      initializeIndex()

      // Clear existing data
      documents.value.clear()

      // Add documents to index
      for (const item of items) {
        const id = item[idField] as string | number
        if (id !== undefined && id !== null) {
          flexIndex.value?.add(item)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documents.value.set(id, item as any)
        }
      }
    } finally {
      isIndexing.value = false
    }
  }

  /**
   * Search the indexed documents
   * @param query - Search query string
   * @param limit - Maximum number of results (default: 20)
   * @returns Array of search results with scores
   */
  const search = async (query: string, limit: number = 20): Promise<FlexSearchResult<T>[]> => {
    if (!query || !query.trim() || !flexIndex.value) {
      return []
    }

    isSearching.value = true

    try {
      // Perform search across all indexed fields
      const results = await flexIndex.value.search(query.trim(), {
        limit,
        enrich: true, // Include document data in results
      })

      // FlexSearch returns results grouped by field
      // We need to merge and deduplicate results
      const mergedResults = new Map<string | number, { item: T; score: number }>()

      for (const fieldResult of results) {
        if (Array.isArray(fieldResult.result)) {
          for (const id of fieldResult.result) {
            const item = documents.value.get(id) as T | undefined
            if (item) {
              // Keep the highest score if duplicate
              const existing = mergedResults.get(id)
              const score = 1 // FlexSearch doesn't provide scores by default
              if (!existing || score > existing.score) {
                mergedResults.set(id, { item: item as T, score })
              }
            }
          }
        }
      }

      // Convert to array and sort by score
      return Array.from(mergedResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    } finally {
      isSearching.value = false
    }
  }

  /**
   * Clear the index and all documents
   */
  const clear = () => {
    if (flexIndex.value) {
      // FlexSearch doesn't have a clear method, so we recreate the index
      flexIndex.value = null
      documents.value.clear()
    }
  }

  /**
   * Get the number of indexed documents
   */
  const getDocumentCount = (): number => {
    return documents.value.size
  }

  /**
   * Export the index for persistence
   * @returns Record of keys and data strings
   */
  const exportIndex = async (): Promise<Record<string, string>> => {
    if (!flexIndex.value) return {}

    return new Promise((resolve) => {
      const exportData: Record<string, string> = {}
      flexIndex.value.export((key: string, data: string) => {
        exportData[key] = data
      })
      // Export is synchronous in current FlexSearch version but wrapped in callback
      // We resolve after a microtask to ensure all callbacks fired (though typically sync)
      setTimeout(() => resolve(exportData), 100)
    })
  }

  /**
   * Import the index from persisted data
   * @param data - Record of keys and data strings
   */
  const importIndex = async (data: Record<string, string>) => {
    initializeIndex()
    if (!flexIndex.value) return

    isIndexing.value = true
    try {
      const keys = Object.keys(data)
      for (const key of keys) {
        await flexIndex.value.import(key, data[key])
      }
    } finally {
      isIndexing.value = false
    }
  }

  return {
    /** Add documents to search index */
    indexDocuments,
    /** Search indexed documents */
    search,
    /** Clear all indexed data */
    clear,
    /** Get count of indexed documents */
    getDocumentCount,
    /** Export index for persistence */
    exportIndex,
    /** Import index from persistence */
    importIndex,
    /** Whether indexing is in progress */
    isIndexing: isIndexing as Readonly<Ref<boolean>>,
    /** Whether search is in progress */
    isSearching: isSearching as Readonly<Ref<boolean>>,
  }
}
