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
import { useBibleSettingsStore } from './bible-settings'

const fetchPromises = new Map<number, Promise<BibleBook[]>>()

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
  content: Map<number, BibleBook[]>
  currentPassage: BiblePassage | null
  isLoading: boolean
  loadingProgress: { loaded: number; total: number } | null
  error: string | null
  isInitialized: boolean

  // ── Actions ────────────────────────────────────────────────
  initialize: () => Promise<void>
  fetchVersionContent: (versionId: number) => Promise<void>
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

export const useBibleStore = create<BibleStore>()(
  persist(
    (set, get) => ({
      versions: [],
      content: new Map(),
      currentPassage: null,
      isLoading: false,
      loadingProgress: null,
      error: null,
      isInitialized: false,

      initialize: async () => {
        const s = get()
        if (s.isLoading) return

        set({ isLoading: true, error: null })

        try {
          let versions: BibleVersion[] = []
          const cachedVersions = await loadBibleVersionMeta()
          if (cachedVersions && cachedVersions.length > 0) {
            versions = cachedVersions
          } else {
            versions = await getAdapter().fetchVersions()
            await saveBibleVersionMeta(versions)
          }

          set({ versions })

          if (versions.length === 0) {
            set({ isLoading: false, isInitialized: true })
            return
          }

          if (!useBibleSettingsStore.getState().selectedVersionId) {
            useBibleSettingsStore.getState().setSelectedVersionId(versions[0].id)
          }

          await Promise.all(versions.map((v) => get().fetchVersionContent(v.id)))

          set({ isInitialized: true, isLoading: false, loadingProgress: null })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          set({ error: message, isLoading: false, loadingProgress: null })
        }
      },

      fetchVersionContent: async (versionId: number) => {
        const s = get()

        if (s.content.has(versionId)) return

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
          const cached = await loadBibleContent(versionId)
          if (cached && cached.length > 0) {
            return cached as BibleBook[]
          }

          const books = await getAdapter().fetchContent(versionId)
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
        if (!s.currentPassage) return
        const { bookNumber, chapter } = s.currentPassage
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
      },

      prevChapter: () => {
        const s = get()
        if (!s.currentPassage) return
        const { bookNumber, chapter } = s.currentPassage

        if (chapter > 1) {
          set({ currentPassage: { bookNumber, chapter: chapter - 1, verse: 1 } })
        } else {
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
        }
      },

      nextVerse: () => {
        const s = get()
        if (!s.currentPassage) return
        const { bookNumber, chapter, verse } = s.currentPassage
        const chapter_ = s.getCurrentChapter()

        if (!chapter_) {
          get().nextChapter()
          return
        }

        const verseCount = chapter_.verses.length

        if (verse < verseCount) {
          set({ currentPassage: { bookNumber, chapter, verse: verse + 1 } })
        } else {
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
        if (!s.currentPassage) return
        const { bookNumber, chapter, verse } = s.currentPassage

        if (verse > 1) {
          set({ currentPassage: { bookNumber, chapter, verse: verse - 1 } })
        } else {
          if (chapter > 1) {
            const prevChapterBooks = s.content.get(s.versions.length > 0 ? s.versions[0].id : 0)
            const book = prevChapterBooks?.find((b) => b.number === bookNumber)
            const prevChapter = book?.chapters.find((c) => c.number === chapter - 1)
            const lastVerse = prevChapter ? prevChapter.verses.length : 1
            set({ currentPassage: { bookNumber, chapter: chapter - 1, verse: lastVerse } })
          } else {
            const prevBook = BIBLE_BOOKS.find((b) => b.number === bookNumber - 1)
            if (prevBook) {
              const prevVersionId = s.versions.length > 0 ? s.versions[0].id : 0
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
          }
        }
      },

      retry: async () => {
        set({ error: null, isInitialized: false })
        await get().initialize()
      },

      getCurrentBook: () => {
        const s = get()
        if (!s.currentPassage) return undefined
        const { bookNumber } = s.currentPassage
        const versionId = s.versions.length > 0 ? s.versions[0].id : 0
        const books = s.content.get(versionId)
        return books?.find((b) => b.number === bookNumber)
      },

      getCurrentChapter: () => {
        const s = get()
        if (!s.currentPassage) return undefined
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
      partialize: () => ({})
    }
  )
)
