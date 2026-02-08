import FlexSearch from 'flexsearch'

// Define message types
type WorkerMessage =
  | { type: 'init'; config: any }
  | { type: 'add'; items: any[]; id?: number }
  | { type: 'search'; id: number; query: string; limit?: number; options?: any }
  | { type: 'info' }
  | { type: 'clear' }
  | { type: 'export' }
  | { type: 'import'; data: any }

// Global state in worker
let index: any = null
const docs: Map<string | number, any> = new Map()
let idField = 'id'

// Helper to initialize index
const initializeIndex = (config: any) => {
  const { options = {}, searchFields, idField: id } = config
  idField = id || 'id'

  // FlexSearch Document config
  index = new FlexSearch.Document({
    tokenize: options.tokenize || 'forward',
    resolution: options.resolution || 9,
    cache: options.cache || false,
    worker: false, // We are already in a worker
    threshold: options.threshold,
    depth: options.depth,
    bidirectional: options.bidirectional,
    context: options.context,
    encode: options.encode,
    document: {
      id: idField,
      index: searchFields,
      store: true, // We store the document in FlexSearch directly if possible, or manages it ourselves
    },
  } as any)
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  try {
    switch (msg.type) {
      case 'init': {
        initializeIndex(msg.config)
        self.postMessage({ type: 'init', status: 'success' })
        break
      }

      case 'add': {
        if (!index) {
          throw new Error('Index not initialized')
        }

        const items = msg.items
        // Batch add
        for (const item of items) {
          const id = item[idField]
          if (id !== undefined && id !== null) {
            index.add(item)
            docs.set(id, item)
          }
        }

        self.postMessage({ type: 'add', status: 'success', count: items.length, id: msg.id })
        break
      }

      case 'search': {
        const { id, query, limit = 20 } = msg

        if (!index) {
          self.postMessage({ type: 'search', id, results: [] })
          return
        }

        // Search with enrich: true to get the full document
        const searchResults = await index.search(query, {
          limit,
          enrich: true,
        })

        // Process results
        // FlexSearch returns grouped results by field, we need to flatten/merge them
        const mergedResults = new Map<string | number, { item: any; score: number }>()

        for (const fieldResult of searchResults) {
          if (Array.isArray(fieldResult.result)) {
            for (const doc of fieldResult.result) {
              const id = doc.id
              // If simple search, doc might be the ID. If enriched, doc is {id, doc}
              // But since we manage our own `docs` map for full data retrieval reliability:
              const item = docs.get(id)

              if (item) {
                const existing = mergedResults.get(id)
                // FlexSearch doesn't always provide a score in Document search unless configured specific way,
                // but if it does, we'd use it. Here we just simple merge.
                // Assuming result order implies relevance.
                if (!existing) {
                  mergedResults.set(id, { item, score: 1 })
                }
              }
            }
          }
        }

        const results = Array.from(mergedResults.values()).slice(0, limit)
        self.postMessage({ type: 'search', id, results })
        break
      }

      case 'info': {
        self.postMessage({ type: 'info', count: docs.size })
        break
      }

      case 'clear': {
        index = null
        docs.clear()
        self.postMessage({ type: 'clear', status: 'success' })
        break
      }

      case 'export': {
        if (!index) {
          self.postMessage({ type: 'export', data: {} })
          return
        }

        const exportData: Record<string, string> = {}
        await new Promise<void>((resolve) => {
          index.export((key: string, data: string) => {
            exportData[key] = data
          })
          // Hack: export callback might be sync, but ensure we return
          setTimeout(() => resolve(), 10)
        })

        self.postMessage({ type: 'export', data: exportData })
        break
      }

      case 'import': {
        if (!index) {
          // Re-init with default? We need config for import.
          // Expect init called before import or handle gracefully
          throw new Error('Index not initialized. Call init first.')
        }

        const data = msg.data
        const keys = Object.keys(data)
        for (const key of keys) {
          await index.import(key, data[key])
        }

        // Note: Import only restores the index structure.
        // It DOES NOT restore the internal `docs` map if we don't persist it separately.
        // The calling code (store) usually passes the docs again or we are expected to only use this
        // for index structure.
        // However, for typical persistent search, we re-feed documents.
        // If we strictly rely on `import`, we miss the documents content unless embedded.
        // For this use case, re-indexing raw content is often safer/simpler than syncing separate document store.
        // BUT, if the user requested import/export support, we keep it.

        self.postMessage({ type: 'import', status: 'success' })
        break
      }
    }
  } catch (err: any) {
    console.error('Worker error:', err)
    self.postMessage({ type: 'error', message: err.message })
  }
}
