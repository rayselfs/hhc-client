import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage
} from '@renderer/workers/bible-search.worker'

export interface BibleVerse {
  id: number
  text: string
}

export class BibleSearchEngine {
  private worker: Worker | null = null
  private ready = false
  private indexed = 0
  private total = 0
  private initPromise: Promise<void> | null = null

  private pendingSearches: Map<
    number,
    { resolve: (ids: number[]) => void; reject: (err: Error) => void }
  > = new Map()

  private searchCounter = 0
  private messageHandlerBound = this.handleMessage.bind(this)

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve, reject) => {
      this.worker = new Worker(new URL('../workers/bible-search.worker.ts', import.meta.url), {
        type: 'module'
      })

      const onReady = (event: MessageEvent<WorkerOutgoingMessage>): void => {
        const { data } = event
        if (data.type === 'READY') {
          this.ready = true
          this.worker?.removeEventListener('message', onReady)
          this.worker?.addEventListener('message', this.messageHandlerBound)
          resolve()
        } else if (data.type === 'ERROR') {
          this.worker?.removeEventListener('message', onReady)
          this.initPromise = null
          reject(new Error(data.message))
        }
      }
      this.worker.addEventListener('message', onReady)
      this.worker.addEventListener('error', (e) => {
        this.initPromise = null
        reject(new Error(e.message))
      })

      const msg: WorkerIncomingMessage = { type: 'INIT' }
      this.worker.postMessage(msg)
    })

    return this.initPromise
  }

  private handleMessage(event: MessageEvent<WorkerOutgoingMessage>): void {
    const { data } = event
    switch (data.type) {
      case 'INDEX_COMPLETE':
        this.indexed = data.total
        this.total = data.total
        break
      case 'PROGRESS':
        this.indexed = data.indexed
        this.total = data.total
        break
      case 'SEARCH_RESULT': {
        const pending = this.pendingSearches.get(data.id)
        if (pending) {
          pending.resolve(data.results)
          this.pendingSearches.delete(data.id)
        }
        break
      }
      case 'ERROR': {
        const err = new Error(data.message)
        for (const p of this.pendingSearches.values()) p.reject(err)
        this.pendingSearches.clear()
        break
      }
    }
  }

  buildIndex(verses: BibleVerse[]): Promise<void> {
    if (!this.worker) {
      return Promise.reject(new Error('BibleSearchEngine not initialized'))
    }

    this.total = verses.length
    this.indexed = 0

    return new Promise((resolve, reject) => {
      const onBuildComplete = (event: MessageEvent<WorkerOutgoingMessage>): void => {
        const { data } = event
        if (data.type === 'INDEX_COMPLETE') {
          this.worker?.removeEventListener('message', onBuildComplete)
          resolve()
        } else if (data.type === 'ERROR') {
          this.worker?.removeEventListener('message', onBuildComplete)
          reject(new Error(data.message))
        }
      }
      this.worker!.addEventListener('message', onBuildComplete)

      const msg: WorkerIncomingMessage = { type: 'BUILD_INDEX', verses }
      this.worker!.postMessage(msg)
    })
  }

  buildCacheOnly(verses: BibleVerse[]): Promise<{ key: string; data: string }[]> {
    if (!this.worker) {
      return Promise.reject(new Error('BibleSearchEngine not initialized'))
    }

    return new Promise((resolve, reject) => {
      const onCacheBuilt = (event: MessageEvent<WorkerOutgoingMessage>): void => {
        const { data } = event
        if (data.type === 'CACHE_BUILT') {
          this.worker?.removeEventListener('message', onCacheBuilt)
          resolve(data.chunks)
        } else if (data.type === 'ERROR') {
          this.worker?.removeEventListener('message', onCacheBuilt)
          reject(new Error(data.message))
        }
      }
      this.worker!.addEventListener('message', onCacheBuilt)

      const msg: WorkerIncomingMessage = {
        type: 'BUILD_CACHE_ONLY',
        verses
      }
      this.worker!.postMessage(msg)
    })
  }

  exportIndex(): Promise<{ key: string; data: string }[]> {
    if (!this.worker) {
      return Promise.reject(new Error('BibleSearchEngine not initialized'))
    }

    return new Promise((resolve, reject) => {
      const onExported = (event: MessageEvent<WorkerOutgoingMessage>): void => {
        const { data } = event
        if (data.type === 'INDEX_EXPORTED') {
          this.worker?.removeEventListener('message', onExported)
          resolve(data.chunks)
        } else if (data.type === 'ERROR') {
          this.worker?.removeEventListener('message', onExported)
          reject(new Error(data.message))
        }
      }
      this.worker!.addEventListener('message', onExported)

      const msg: WorkerIncomingMessage = { type: 'EXPORT_INDEX' }
      this.worker!.postMessage(msg)
    })
  }

  loadIndex(chunks: { key: string; data: string }[]): Promise<void> {
    if (!this.worker) {
      return Promise.reject(new Error('BibleSearchEngine not initialized'))
    }

    return new Promise((resolve, reject) => {
      const onLoaded = (event: MessageEvent<WorkerOutgoingMessage>): void => {
        const { data } = event
        if (data.type === 'INDEX_LOADED') {
          this.worker?.removeEventListener('message', onLoaded)
          resolve()
        } else if (data.type === 'ERROR') {
          this.worker?.removeEventListener('message', onLoaded)
          reject(new Error(data.message))
        }
      }
      this.worker!.addEventListener('message', onLoaded)

      const msg: WorkerIncomingMessage = { type: 'LOAD_INDEX', chunks }
      this.worker!.postMessage(msg)
    })
  }

  search(query: string, limit = 20): Promise<number[]> {
    if (!this.worker) {
      return Promise.reject(new Error('BibleSearchEngine not initialized'))
    }

    const id = ++this.searchCounter
    return new Promise((resolve, reject) => {
      this.pendingSearches.set(id, { resolve, reject })
      const msg: WorkerIncomingMessage = { type: 'SEARCH', query, limit, id }
      this.worker!.postMessage(msg)
    })
  }

  getProgress(): { indexed: number; total: number } {
    return { indexed: this.indexed, total: this.total }
  }

  isReady(): boolean {
    return this.ready
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready = false
    this.indexed = 0
    this.total = 0
    this.initPromise = null
    const err = new Error('disposed')
    for (const p of this.pendingSearches.values()) p.reject(err)
    this.pendingSearches.clear()
  }
}
