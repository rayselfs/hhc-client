import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage
} from '@renderer/workers/bible-search.worker'
import { useBibleSearchStore } from '@renderer/stores/bible-search'
import type { BibleSearchResult } from '@renderer/stores/bible-search'
import type { BibleBook, BibleVersion } from '@shared/types/bible'
import { saveFlexSearchCache, loadFlexSearchCache } from '@renderer/lib/bible-db'

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

export const searchEngine = new BibleSearchEngine()

const verseLookups = new Map<number, Map<number, BibleSearchResult>>()

function buildVerseLookup(versionId: number, books: BibleBook[]): void {
  const map = new Map<number, BibleSearchResult>()
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        map.set(verse.id, {
          verseId: verse.id,
          bookNumber: book.number,
          chapter: chapter.number,
          verse: verse.number,
          text: verse.text
        })
      }
    }
  }
  verseLookups.set(versionId, map)
}

function extractVerses(books: BibleBook[]): { id: number; text: string }[] {
  const verses: { id: number; text: string }[] = []
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        verses.push({ id: verse.id, text: verse.text })
      }
    }
  }
  return verses
}

let activeVersionId: number | null = null
let initPromise: Promise<void> | null = null

export async function initializeSearchIndexes(
  allVersionsBooks: Map<number, BibleBook[]>,
  versions: BibleVersion[],
  selectedVersionId: number
): Promise<void> {
  if (initPromise) return initPromise
  initPromise = doInitialize(allVersionsBooks, versions, selectedVersionId)
  return initPromise
}

async function doInitialize(
  allVersionsBooks: Map<number, BibleBook[]>,
  versions: BibleVersion[],
  selectedVersionId: number
): Promise<void> {
  const { setIndexReady } = useBibleSearchStore.getState()

  try {
    await searchEngine.init()

    const selectedVersion = versions.find((v) => v.id === selectedVersionId)
    const selectedBooks = allVersionsBooks.get(selectedVersionId)

    if (!selectedVersion || !selectedBooks || selectedBooks.length === 0) {
      return
    }

    buildVerseLookup(selectedVersionId, selectedBooks)

    const cached = await loadFlexSearchCache(selectedVersionId, selectedVersion.updatedAt)
    if (cached) {
      await searchEngine.loadIndex(cached)
    } else {
      const verses = extractVerses(selectedBooks)
      await searchEngine.buildIndex(verses)
      const chunks = await searchEngine.exportIndex()
      saveFlexSearchCache(selectedVersionId, selectedVersion.updatedAt, chunks).catch(() => {})
    }

    activeVersionId = selectedVersionId
    setIndexReady(true)

    for (const version of versions) {
      if (version.id === selectedVersionId) continue
      const books = allVersionsBooks.get(version.id)
      if (!books || books.length === 0) continue
      buildBackgroundCache(version, books).catch(() => {})
    }
  } catch (err) {
    console.error('[bible-search] Failed to initialize search index:', err)
  }
}

async function buildBackgroundCache(version: BibleVersion, books: BibleBook[]): Promise<void> {
  const existing = await loadFlexSearchCache(version.id, version.updatedAt)
  if (existing) {
    buildVerseLookup(version.id, books)
    return
  }

  buildVerseLookup(version.id, books)
  const verses = extractVerses(books)
  const chunks = await searchEngine.buildCacheOnly(verses)
  saveFlexSearchCache(version.id, version.updatedAt, chunks).catch(() => {})
}

let switchGeneration = 0

export async function switchVersionIndex(
  versionId: number,
  version: BibleVersion,
  books: BibleBook[]
): Promise<void> {
  if (activeVersionId === versionId) return

  const gen = ++switchGeneration
  const { setIndexReady } = useBibleSearchStore.getState()
  setIndexReady(false)

  try {
    buildVerseLookup(versionId, books)

    const cached = await loadFlexSearchCache(versionId, version.updatedAt)
    if (gen !== switchGeneration) return

    if (cached) {
      await searchEngine.loadIndex(cached)
    } else {
      const verses = extractVerses(books)
      await searchEngine.buildIndex(verses)
      if (gen !== switchGeneration) return
      const chunks = await searchEngine.exportIndex()
      saveFlexSearchCache(versionId, version.updatedAt, chunks).catch(() => {})
    }

    if (gen !== switchGeneration) return

    activeVersionId = versionId
    setIndexReady(true)
  } catch {
    if (gen === switchGeneration) {
      setIndexReady(false)
    }
  }
}

export function lookupVerseById(id: number): BibleSearchResult | undefined {
  if (!activeVersionId) return undefined
  return verseLookups.get(activeVersionId)?.get(id)
}
