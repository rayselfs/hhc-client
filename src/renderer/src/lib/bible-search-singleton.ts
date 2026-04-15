import { BibleSearchEngine } from '@renderer/lib/bible-search'
import { useBibleSearchStore } from '@renderer/stores/bible-search'
import type { BibleSearchResult } from '@renderer/stores/bible-search'
import type { BibleBook, BibleVersion } from '@shared/types/bible'
import { saveFlexSearchCache, loadFlexSearchCache } from '@renderer/lib/bible-db'

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
