import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BibleVersion, BibleBook, BiblePassage } from '@shared/types/bible'
import { BIBLE_BOOKS } from '@shared/types/bible'
import { createBibleApiAdapter, type BibleApiAdapter } from '@renderer/lib/bible-api'
import {
  saveBibleContent,
  loadBibleContent,
  saveBibleVersionMeta,
  loadBibleVersionMeta
} from '@renderer/lib/bible-db'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

// Module-level fetch deduplication: versionId → in-flight Promise
const fetchPromises = new Map<string, Promise<BibleBook[]>>()

// Module-level adapter (lazy init)
let adapter: BibleApiAdapter | null = null

function getAdapter(): BibleApiAdapter {
  if (!adapter) {
    adapter = createBibleApiAdapter()
  }
  return adapter
}

export interface BibleStore {
  // ── State ──────────────────────────────────────────────────
  versions: BibleVersion[]
  content: Map<string, BibleBook[]>
  currentPassage: BiblePassage
  isLoading: boolean
  loadingProgress: { loaded: number; total: number } | null
  error: string | null
  isInitialized: boolean

  // ── Actions ────────────────────────────────────────────────
  initialize: () => Promise<void>
  fetchVersionContent: (versionId: string) => Promise<void>
  navigateTo: (passage: BiblePassage) => void
  nextChapter: () => void
  prevChapter: () => void
  nextVerse: () => void
  prevVerse: () => void
  retry: () => Promise<void>

  // ── Derived getters ────────────────────────────────────────
  getCurrentBook: () => BibleBook | undefined
  getCurrentChapter: () => BibleBook['chapters'][number] | undefined
  getCurrentVerses: () => BibleBook['chapters'][number]['verses']
}

const DEFAULT_PASSAGE: BiblePassage = {
  bookNumber: 1,
  chapter: 1,
  verse: 1
}

export const useBibleStore = create<BibleStore>()(
  persist(
    (set, get) => ({
      versions: [],
      content: new Map(),
      currentPassage: DEFAULT_PASSAGE,
      isLoading: false,
      loadingProgress: null,
      error: null,
      isInitialized: false,

      initialize: async () => {
        const s = get()
        if (s.isLoading) return

        set({ isLoading: true, error: null })

        try {
          // Fetch versions (cache-first)
          let versions: BibleVersion[] = []
          const cachedVersions = await loadBibleVersionMeta()
          if (cachedVersions && cachedVersions.length > 0) {
            versions = cachedVersions
          } else {
            versions = await getAdapter().fetchVersions()
            await saveBibleVersionMeta(versions)
          }

          set({ versions })

          // Determine selected version: use first available
          if (versions.length === 0) {
            set({ isLoading: false, isInitialized: true })
            return
          }

          const selectedVersionId = versions[0].id

          // Fetch content for selected version
          await get().fetchVersionContent(selectedVersionId)

          set({ isInitialized: true, isLoading: false, loadingProgress: null })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          set({ error: message, isLoading: false, loadingProgress: null })
        }
      },

      fetchVersionContent: async (versionId: string) => {
        const s = get()

        // Already in content map — skip
        if (s.content.has(versionId)) return

        // Deduplicate in-flight fetches
        if (fetchPromises.has(versionId)) {
          try {
            const books = await fetchPromises.get(versionId)!
            const newContent = new Map(get().content)
            newContent.set(versionId, books)
            set({ content: newContent })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            set({ error: message, isLoading: false, loadingProgress: null })
          }
          return
        }

        set({ isLoading: true, error: null, loadingProgress: { loaded: 0, total: 66 } })

        const fetchPromise = (async (): Promise<BibleBook[]> => {
          // Cache-first: check IndexedDB
          const cached = await loadBibleContent(versionId)
          if (cached && cached.length > 0) {
            return cached as BibleBook[]
          }

          // Fetch from API
          const books = await getAdapter().fetchContent(versionId)

          // Save to IndexedDB
          await saveBibleContent(versionId, books)

          return books
        })()

        fetchPromises.set(versionId, fetchPromise)

        try {
          const books = await fetchPromise
          const newContent = new Map(get().content)
          newContent.set(versionId, books)
          set({
            content: newContent,
            isLoading: false,
            loadingProgress: null
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          set({ error: message, isLoading: false, loadingProgress: null })
        } finally {
          fetchPromises.delete(versionId)
        }
      },

      navigateTo: (passage: BiblePassage) => {
        set({ currentPassage: passage })
      },

      nextChapter: () => {
        const s = get()
        const { bookNumber, chapter } = s.currentPassage
        const bookConfig = BIBLE_BOOKS.find((b) => b.number === bookNumber)
        if (!bookConfig) return

        if (chapter < bookConfig.chapterCount) {
          // Move to next chapter in same book
          set({ currentPassage: { bookNumber, chapter: chapter + 1, verse: 1 } })
        } else {
          // Move to first chapter of next book
          const nextBook = BIBLE_BOOKS.find((b) => b.number === bookNumber + 1)
          if (nextBook) {
            set({ currentPassage: { bookNumber: nextBook.number, chapter: 1, verse: 1 } })
          }
          // If last book (Revelation), stay
        }
      },

      prevChapter: () => {
        const s = get()
        const { bookNumber, chapter } = s.currentPassage

        if (chapter > 1) {
          // Move to previous chapter in same book
          set({ currentPassage: { bookNumber, chapter: chapter - 1, verse: 1 } })
        } else {
          // Move to last chapter of previous book
          const prevBook = BIBLE_BOOKS.find((b) => b.number === bookNumber - 1)
          if (prevBook) {
            set({
              currentPassage: {
                bookNumber: prevBook.number,
                chapter: prevBook.chapterCount,
                verse: 1
              }
            })
          }
          // If first book (Genesis ch1), stay
        }
      },

      nextVerse: () => {
        const s = get()
        const { bookNumber, chapter, verse } = s.currentPassage
        const chapter_ = s.getCurrentChapter()

        if (!chapter_) {
          // No content loaded — use BIBLE_BOOKS config to navigate chapters
          get().nextChapter()
          return
        }

        const verseCount = chapter_.verses.length

        if (verse < verseCount) {
          // Move to next verse in same chapter
          set({ currentPassage: { bookNumber, chapter, verse: verse + 1 } })
        } else {
          // Move to first verse of next chapter (cross-book if needed)
          const bookConfig = BIBLE_BOOKS.find((b) => b.number === bookNumber)
          if (!bookConfig) return

          if (chapter < bookConfig.chapterCount) {
            set({ currentPassage: { bookNumber, chapter: chapter + 1, verse: 1 } })
          } else {
            const nextBook = BIBLE_BOOKS.find((b) => b.number === bookNumber + 1)
            if (nextBook) {
              set({ currentPassage: { bookNumber: nextBook.number, chapter: 1, verse: 1 } })
            }
          }
        }
      },

      prevVerse: () => {
        const s = get()
        const { bookNumber, chapter, verse } = s.currentPassage

        if (verse > 1) {
          // Move to previous verse in same chapter
          set({ currentPassage: { bookNumber, chapter, verse: verse - 1 } })
        } else {
          // Move to last verse of previous chapter (cross-book if needed)
          if (chapter > 1) {
            // Go to previous chapter in same book, last verse
            const prevChapterBooks = s.content.get(s.versions.length > 0 ? s.versions[0].id : '')
            const book = prevChapterBooks?.find((b) => b.number === bookNumber)
            const prevChapter = book?.chapters.find((c) => c.number === chapter - 1)
            const lastVerse = prevChapter ? prevChapter.verses.length : 1
            set({ currentPassage: { bookNumber, chapter: chapter - 1, verse: lastVerse } })
          } else {
            // Cross-book: go to last verse of last chapter of previous book
            const prevBook = BIBLE_BOOKS.find((b) => b.number === bookNumber - 1)
            if (prevBook) {
              const prevVersionId = s.versions.length > 0 ? s.versions[0].id : ''
              const prevBookContent = s.content
                .get(prevVersionId)
                ?.find((b) => b.number === prevBook.number)
              const lastChapter = prevBookContent?.chapters[prevBookContent.chapters.length - 1]
              const lastVerse = lastChapter ? lastChapter.verses.length : 1
              set({
                currentPassage: {
                  bookNumber: prevBook.number,
                  chapter: prevBook.chapterCount,
                  verse: lastVerse
                }
              })
            }
            // If Genesis ch1 v1, stay
          }
        }
      },

      retry: async () => {
        set({ error: null, isInitialized: false })
        await get().initialize()
      },

      getCurrentBook: () => {
        const s = get()
        const { bookNumber } = s.currentPassage
        const versionId = s.versions.length > 0 ? s.versions[0].id : ''
        const books = s.content.get(versionId)
        return books?.find((b) => b.number === bookNumber)
      },

      getCurrentChapter: () => {
        const s = get()
        const { chapter } = s.currentPassage
        const book = s.getCurrentBook()
        return book?.chapters.find((c) => c.number === chapter)
      },

      getCurrentVerses: () => {
        const s = get()
        const chapter = s.getCurrentChapter()
        return chapter?.verses ?? []
      }
    }),
    {
      name: createKey('bible'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        currentPassage: state.currentPassage
      })
    }
  )
)
