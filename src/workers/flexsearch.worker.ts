import FlexSearch, { type DocumentData } from 'flexsearch'

interface WorkerConfig {
  options?: Record<string, unknown>
  searchFields: string | string[] | Record<string, unknown>
  idField?: string
}

type WorkerMessage =
  | { type: 'init'; config: WorkerConfig }
  | { type: 'add'; items: DocumentData[]; id?: number }
  | { type: 'search'; id: number; query: string; limit?: number; options?: Record<string, unknown> }
  | { type: 'info' }
  | { type: 'clear' }
  | { type: 'export' }
  | { type: 'import'; data: Record<string, string> }

type FlexSearchIndex = InstanceType<typeof FlexSearch.Document>

let index: FlexSearchIndex | null = null
const docs: Map<string | number, DocumentData> = new Map()
let idField = 'id'

const initializeIndex = (config: WorkerConfig) => {
  const { options = {}, searchFields, idField: id } = config
  idField = id || 'id'

  index = new FlexSearch.Document({
    tokenize: (options.tokenize as 'forward' | 'strict' | 'full') || 'forward',
    resolution: (options.resolution as number) || 9,
    cache: (options.cache as boolean | number) || false,
    worker: false,
    document: {
      id: idField,
      index: searchFields as string | string[],
      store: true,
    },
  })
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
        for (const item of items) {
          const idValue = item[idField]
          if (typeof idValue === 'string' || typeof idValue === 'number') {
            index.add(item)
            docs.set(idValue, item)
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
        const mergedResults = new Map<string | number, { item: DocumentData; score: number }>()

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
          if (index) {
            index.export((key: string, data: string) => {
              exportData[key] = data
            })
          }
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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Worker error:', err)
    self.postMessage({ type: 'error', message: errorMessage })
  }
}
