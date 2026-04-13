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

async function buildAndCacheVersion(
  versionId: number,
  updatedAt: number,
  books: BibleBook[]
): Promise<{ key: string; data: string }[]> {
  buildVerseLookup(versionId, books)
  const verses = extractVerses(books)
  await searchEngine.buildIndex(verses)
  const chunks = await searchEngine.exportIndex()
  saveFlexSearchCache(versionId, updatedAt, chunks).catch(() => {})
  return chunks
}

let activeVersionId: number | null = null

export async function initializeSearchIndexes(
  allVersionsBooks: Map<number, BibleBook[]>,
  versions: BibleVersion[],
  selectedVersionId: number
): Promise<void> {
  const { setIndexReady } = useBibleSearchStore.getState()

  try {
    await searchEngine.init()

    const selectedVersion = versions.find((v) => v.id === selectedVersionId)
    const selectedBooks = allVersionsBooks.get(selectedVersionId)

    if (!selectedVersion || !selectedBooks || selectedBooks.length === 0) return

    buildVerseLookup(selectedVersionId, selectedBooks)

    const cached = await loadFlexSearchCache(selectedVersionId, selectedVersion.updatedAt)
    if (cached) {
      await searchEngine.loadIndex(cached)
    } else {
      await buildAndCacheVersion(selectedVersionId, selectedVersion.updatedAt, selectedBooks)
    }

    activeVersionId = selectedVersionId
    setIndexReady(true)

    // Build remaining versions in background (fire-and-forget)
    for (const version of versions) {
      if (version.id === selectedVersionId) continue
      const books = allVersionsBooks.get(version.id)
      if (!books || books.length === 0) continue

      loadFlexSearchCache(version.id, version.updatedAt)
        .then((existing) => {
          if (existing) {
            buildVerseLookup(version.id, books)
            return
          }
          return buildAndCacheVersion(version.id, version.updatedAt, books).then(() => {})
        })
        .catch(() => {})
    }
  } catch {
    // intentionally silent
  }
}

export async function switchVersionIndex(
  versionId: number,
  version: BibleVersion,
  books: BibleBook[]
): Promise<void> {
  if (activeVersionId === versionId) return

  const { setIndexReady } = useBibleSearchStore.getState()
  setIndexReady(false)

  try {
    buildVerseLookup(versionId, books)

    const cached = await loadFlexSearchCache(versionId, version.updatedAt)
    if (cached) {
      await searchEngine.loadIndex(cached)
    } else {
      await buildAndCacheVersion(versionId, version.updatedAt, books)
    }

    activeVersionId = versionId
    setIndexReady(true)
  } catch {
    // intentionally silent
  }
}

export function lookupVerseById(id: number): BibleSearchResult | undefined {
  if (!activeVersionId) return undefined
  return verseLookups.get(activeVersionId)?.get(id)
}
