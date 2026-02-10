import { ref, type Ref, onUnmounted } from 'vue'

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
    context?: boolean | { resolution: number; depth: number; bidirectional: boolean }
    encode?: boolean | string | ((str: string) => string)
  }
}

/**
 * Search result with score
 */
export interface FlexSearchResult<T> {
  item: T
  score?: number
}

// Timeout configuration
const SEARCH_TIMEOUT_MS = 30000

/**
 * Generic FlexSearch composable for full-text searching
 * Uses a Web Worker to avoid blocking the main thread.
 */
export function useFlexSearch<T extends Record<string, unknown>>(config: FlexSearchConfig<T>) {
  const { searchFields, idField, options = {} } = config

  // Current options
  let currentOptions = { ...options }

  const isIndexing = ref(false)
  const isSearching = ref(false)
  const documentCount = ref(0)

  // Worker instance
  let worker: Worker | null = null

  // Pending request resolvers
  const pendingSearches = new Map<number, (results: FlexSearchResult<T>[]) => void>()
  let nextId = 1

  let exportResolve: ((data: Record<string, string>) => void) | null = null
  let importResolve: (() => void) | null = null

  /**
   * Initialize the FlexSearch worker
   */
  const initializeWorker = () => {
    if (worker) return

    worker = new Worker(new URL('../workers/flexsearch.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      switch (msg.type) {
        case 'init':
          // Init complete
          break

        case 'add':
          // Use id to resolve if present
          if (typeof msg.id === 'number') {
            const resolve = pendingSearches.get(msg.id)
            if (resolve) {
              resolve([])
              pendingSearches.delete(msg.id)
            }
          }

          if (pendingSearches.size === 0) {
            isIndexing.value = false
          }

          // We could track count here if returned
          if (typeof msg.count === 'number') {
            documentCount.value += msg.count
          }
          break

        case 'search':
          if (typeof msg.id === 'number') {
            const resolve = pendingSearches.get(msg.id)
            if (resolve) {
              resolve(msg.results)
              pendingSearches.delete(msg.id)
            }
          }
          isSearching.value = pendingSearches.size > 0
          break

        case 'info':
          if (typeof msg.count === 'number') {
            documentCount.value = msg.count
          }
          break

        case 'clear':
          documentCount.value = 0
          break

        case 'export':
          if (exportResolve) {
            exportResolve(msg.data)
            exportResolve = null
          }
          break

        case 'import':
          isIndexing.value = false
          if (importResolve) {
            importResolve()
            importResolve = null
          }
          break

        case 'error':
          console.error('FlexSearch Worker Error:', msg.message)
          isIndexing.value = false
          isSearching.value = false
          // Clear all pending searches on error
          pendingSearches.forEach((resolve) => resolve([]))
          pendingSearches.clear()
          break
      }
    }

    // Send init config
    worker.postMessage({
      type: 'init',
      config: {
        searchFields,
        idField,
        options: currentOptions,
      },
    })
  }

  /**
   * Update options and re-initialize worker
   * This effectively resets the index
   */
  const updateOptions = (newOptions: FlexSearchConfig<T>['options']) => {
    currentOptions = { ...currentOptions, ...newOptions }

    // Completely restart the worker to ensure clean state
    if (worker) {
      worker.terminate()
      worker = null

      // Clear pending searches as they will effectively be cancelled
      pendingSearches.forEach((resolve) => resolve([]))
      pendingSearches.clear()

      // Reset state
      documentCount.value = 0
      isIndexing.value = false
      isSearching.value = false

      // Re-initialize (will be lazy loaded next time or we can force it)
      // We don't force initialize here, let the next action trigger it
      // But if we want to ensure config is applied immediately for subsequent calls:
      // initializeWorker()
    }
  }

  /**
   * Add documents to the index
   */
  const indexDocuments = async (items: T[]) => {
    if (!items || items.length === 0) return
    initializeWorker()

    isIndexing.value = true
    const id = nextId++

    return new Promise<void>((resolve) => {
      // Store resolve in the map. Since pendingSearches expects (results: any[]) => void,
      // we cast our resolve to any to satisfy it, even though we resolve with void
      // Alternatively, we could update the map type, but reusing it is simpler for now.
      pendingSearches.set(id, () => resolve())

      worker?.postMessage({
        type: 'add',
        id,
        items: JSON.parse(JSON.stringify(items)), // Strip proxies
      })
    })
  }

  /**
   * Search the indexed documents
   */
  const search = async (query: string, limit: number = 20): Promise<FlexSearchResult<T>[]> => {
    if (!query || !query.trim()) return []
    initializeWorker()

    const id = nextId++
    isSearching.value = true

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (pendingSearches.has(id)) {
          console.warn(`Search request ${id} timed out`)
          pendingSearches.delete(id)
          isSearching.value = pendingSearches.size > 0
          resolve([])
        }
      }, SEARCH_TIMEOUT_MS)

      pendingSearches.set(id, (results) => {
        clearTimeout(timeoutId)
        resolve(results)
      })

      worker?.postMessage({
        type: 'search',
        id,
        query,
        limit,
      })
    })
  }

  /**
   * Clear the index
   */
  const clear = () => {
    worker?.postMessage({ type: 'clear' })
  }

  /**
   * Get document count
   * This is now async in nature but we return the cached value.
   * We can trigger an update.
   */
  const getDocumentCount = (): number => {
    // Request update for next time
    worker?.postMessage({ type: 'info' })
    return documentCount.value
  }

  /**
   * Export the index
   */
  const exportIndex = async (): Promise<Record<string, string>> => {
    initializeWorker()
    return new Promise((resolve) => {
      exportResolve = resolve
      worker?.postMessage({ type: 'export' })
    })
  }

  /**
   * Import the index
   */
  const importIndex = async (data: Record<string, string>) => {
    initializeWorker()
    isIndexing.value = true
    return new Promise<void>((resolve) => {
      importResolve = resolve
      worker?.postMessage({ type: 'import', data })
    })
  }

  // Cleanup
  onUnmounted(() => {
    worker?.terminate()
    worker = null
  })

  /**
   * Reset the worker completely
   */
  const reset = () => {
    if (worker) {
      worker.terminate()
      worker = null
    }
    // Clear pending searches
    pendingSearches.forEach((resolve) => resolve([]))
    pendingSearches.clear()

    // Reset state
    documentCount.value = 0
    isIndexing.value = false
    isSearching.value = false
  }

  return {
    indexDocuments,
    search,
    clear,
    reset,
    getDocumentCount,
    exportIndex,
    importIndex,
    updateOptions,
    isIndexing: isIndexing as Readonly<Ref<boolean>>,
    isSearching: isSearching as Readonly<Ref<boolean>>,
  }
}
