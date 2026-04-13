import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

const lazyLocalStorage = vi.hoisted(() => ({
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name)
}))

vi.mock('@renderer/lib/persist-storage', () => ({
  hhcPersistStorage: createJSONStorage(() => lazyLocalStorage),
  createKey: (name: string) => `hhc-${name}`
}))

const mockFetchVersions = vi.fn()
const mockFetchContent = vi.fn()

vi.mock('@renderer/lib/bible-api', () => ({
  createBibleApiAdapter: () => ({
    fetchVersions: mockFetchVersions,
    fetchContent: mockFetchContent
  })
}))

const mockLoadBibleContent = vi.fn()
const mockSaveBibleContent = vi.fn()
const mockLoadBibleVersionMeta = vi.fn()
const mockSaveBibleVersionMeta = vi.fn()

vi.mock('@renderer/lib/bible-db', () => ({
  loadBibleContent: (...args: unknown[]) => mockLoadBibleContent(...args),
  saveBibleContent: (...args: unknown[]) => mockSaveBibleContent(...args),
  loadBibleVersionMeta: (...args: unknown[]) => mockLoadBibleVersionMeta(...args),
  saveBibleVersionMeta: (...args: unknown[]) => mockSaveBibleVersionMeta(...args),
  saveFolderTree: vi.fn(),
  loadFolderTree: vi.fn()
}))

import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import type { BibleBook, BibleVersion } from '@shared/types/bible'

const VERSION_1: BibleVersion = { id: 1, code: 'KJV', name: 'King James', updatedAt: 1765861998 }

const makeBook = (number: number, chapterCount = 2, verseCount = 3): BibleBook => ({
  number,
  code: `B${number}`,
  name: `Book ${number}`,
  abbreviation: `B${number}`,
  chapters: Array.from({ length: chapterCount }, (_, ci) => ({
    number: ci + 1,
    verses: Array.from({ length: verseCount }, (_, vi_) => ({
      id: number * 1000 + (ci + 1) * 100 + (vi_ + 1),
      number: vi_ + 1,
      text: `Verse text ${vi_ + 1}`
    }))
  }))
})

const INITIAL_STATE = {
  versions: [],
  content: new Map(),
  currentPassage: { bookNumber: 1, chapter: 1, verse: 1 },
  isLoading: false,
  loadingProgress: null,
  error: null,
  isInitialized: false
}

beforeEach(() => {
  useBibleStore.setState(INITIAL_STATE)
  useBibleSettingsStore.setState({ fontSize: 90, selectedVersionId: 0 })
  mockFetchVersions.mockReset()
  mockFetchContent.mockReset()
  mockLoadBibleContent.mockReset()
  mockSaveBibleContent.mockReset()
  mockLoadBibleVersionMeta.mockReset()
  mockSaveBibleVersionMeta.mockReset()
  mockLoadBibleContent.mockResolvedValue(undefined)
  mockLoadBibleVersionMeta.mockResolvedValue(undefined)
  mockSaveBibleContent.mockResolvedValue(undefined)
  mockSaveBibleVersionMeta.mockResolvedValue(undefined)
})

describe('initial state', () => {
  it('starts with correct defaults', () => {
    const s = useBibleStore.getState()
    expect(s.versions).toEqual([])
    expect(s.content.size).toBe(0)
    expect(s.currentPassage).toEqual({ bookNumber: 1, chapter: 1, verse: 1 })
    expect(s.isLoading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.isInitialized).toBe(false)
  })
})

describe('initialize()', () => {
  it('sets isInitialized to true on success', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockResolvedValue([VERSION_1])
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockResolvedValue([makeBook(1)])

    await useBibleStore.getState().initialize()

    expect(useBibleStore.getState().isInitialized).toBe(true)
    expect(useBibleStore.getState().isLoading).toBe(false)
  })

  it('uses cached versions when available', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue([VERSION_1])
    mockLoadBibleContent.mockResolvedValue([makeBook(1)])

    await useBibleStore.getState().initialize()

    expect(mockFetchVersions).not.toHaveBeenCalled()
    expect(useBibleStore.getState().versions).toEqual([VERSION_1])
  })

  it('fetches versions from API when cache is empty', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockResolvedValue([VERSION_1])
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockResolvedValue([makeBook(1)])

    await useBibleStore.getState().initialize()

    expect(mockFetchVersions).toHaveBeenCalledTimes(1)
    expect(mockSaveBibleVersionMeta).toHaveBeenCalledWith([VERSION_1])
  })

  it('sets error state when API throws', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockRejectedValue(new Error('Network failure'))

    await useBibleStore.getState().initialize()

    const s = useBibleStore.getState()
    expect(s.error).toBe('Network failure')
    expect(s.isLoading).toBe(false)
    expect(s.isInitialized).toBe(false)
  })

  it('is a no-op when already loading', async () => {
    useBibleStore.setState({ isLoading: true })
    await useBibleStore.getState().initialize()
    expect(mockFetchVersions).not.toHaveBeenCalled()
    expect(mockLoadBibleVersionMeta).not.toHaveBeenCalled()
  })

  it('handles empty versions list gracefully', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockResolvedValue([])

    await useBibleStore.getState().initialize()

    const s = useBibleStore.getState()
    expect(s.isInitialized).toBe(true)
    expect(s.isLoading).toBe(false)
  })

  it('sets selectedVersionId in settings store when empty (bug fix #6)', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockResolvedValue([VERSION_1])
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockResolvedValue([makeBook(1)])
    useBibleSettingsStore.setState({ fontSize: 90, selectedVersionId: 0 })

    await useBibleStore.getState().initialize()

    expect(useBibleSettingsStore.getState().selectedVersionId).toBe(1)
  })

  it('does not overwrite existing selectedVersionId in settings store', async () => {
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockResolvedValue([VERSION_1])
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockResolvedValue([makeBook(1)])
    useBibleSettingsStore.setState({ fontSize: 90, selectedVersionId: 99 })

    await useBibleStore.getState().initialize()

    expect(useBibleSettingsStore.getState().selectedVersionId).toBe(99)
  })
})

describe('fetchVersionContent() — cache strategy', () => {
  it('uses cached DB content when available (cache hit)', async () => {
    const book = makeBook(1)
    mockLoadBibleContent.mockResolvedValue([book])

    await useBibleStore.getState().fetchVersionContent(1)

    expect(mockFetchContent).not.toHaveBeenCalled()
    expect(useBibleStore.getState().content.get(1)).toEqual([book])
  })

  it('fetches from API when DB cache is empty (cache miss)', async () => {
    const book = makeBook(1)
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockResolvedValue([book])

    await useBibleStore.getState().fetchVersionContent(1)

    expect(mockFetchContent).toHaveBeenCalledWith(1)
    expect(mockSaveBibleContent).toHaveBeenCalledWith(1, [book])
    expect(useBibleStore.getState().content.get(1)).toEqual([book])
  })

  it('skips fetch when content already in memory', async () => {
    const book = makeBook(1)
    const existingContent = new Map([[1, [book]]])
    useBibleStore.setState({ content: existingContent })

    await useBibleStore.getState().fetchVersionContent(1)

    expect(mockLoadBibleContent).not.toHaveBeenCalled()
    expect(mockFetchContent).not.toHaveBeenCalled()
  })

  it('sets error when fetch fails', async () => {
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockRejectedValue(new Error('API down'))

    await useBibleStore.getState().fetchVersionContent(1)

    const s = useBibleStore.getState()
    expect(s.error).toBe('API down')
    expect(s.isLoading).toBe(false)
  })
})

describe('request deduplication', () => {
  it('does not start a second fetch when one is in-flight', async () => {
    let resolveFirst!: (v: BibleBook[]) => void
    const firstFetch = new Promise<BibleBook[]>((resolve) => {
      resolveFirst = resolve
    })
    mockLoadBibleContent.mockResolvedValue(undefined)
    mockFetchContent.mockReturnValueOnce(firstFetch)

    const p1 = useBibleStore.getState().fetchVersionContent(1)
    const p2 = useBibleStore.getState().fetchVersionContent(1)

    resolveFirst([makeBook(1)])
    await Promise.all([p1, p2])

    expect(mockFetchContent).toHaveBeenCalledTimes(1)
  })
})

describe('navigateTo()', () => {
  it('updates currentPassage', () => {
    useBibleStore.getState().navigateTo({ bookNumber: 3, chapter: 2, verse: 5 })
    expect(useBibleStore.getState().currentPassage).toEqual({ bookNumber: 3, chapter: 2, verse: 5 })
  })
})

describe('nextChapter()', () => {
  it('advances to next chapter within same book', () => {
    useBibleStore.setState({ currentPassage: { bookNumber: 1, chapter: 1, verse: 1 } })
    useBibleStore.getState().nextChapter()
    expect(useBibleStore.getState().currentPassage).toEqual({ bookNumber: 1, chapter: 2, verse: 1 })
  })

  it('advances to first chapter of next book at book boundary', () => {
    useBibleStore.setState({ currentPassage: { bookNumber: 1, chapter: 50, verse: 1 } })
    useBibleStore.getState().nextChapter()
    expect(useBibleStore.getState().currentPassage).toEqual({ bookNumber: 2, chapter: 1, verse: 1 })
  })

  it('does nothing at the last chapter of last book', () => {
    useBibleStore.setState({ currentPassage: { bookNumber: 66, chapter: 22, verse: 1 } })
    useBibleStore.getState().nextChapter()
    expect(useBibleStore.getState().currentPassage).toEqual({
      bookNumber: 66,
      chapter: 22,
      verse: 1
    })
  })
})

describe('prevChapter()', () => {
  it('goes back one chapter within same book', () => {
    useBibleStore.setState({ currentPassage: { bookNumber: 1, chapter: 3, verse: 1 } })
    useBibleStore.getState().prevChapter()
    expect(useBibleStore.getState().currentPassage).toEqual({ bookNumber: 1, chapter: 2, verse: 1 })
  })

  it('goes to last chapter of previous book at chapter 1', () => {
    useBibleStore.setState({ currentPassage: { bookNumber: 2, chapter: 1, verse: 1 } })
    useBibleStore.getState().prevChapter()
    expect(useBibleStore.getState().currentPassage).toEqual({
      bookNumber: 1,
      chapter: 50,
      verse: 1
    })
  })

  it('does nothing at book 1 chapter 1', () => {
    useBibleStore.setState({ currentPassage: { bookNumber: 1, chapter: 1, verse: 1 } })
    useBibleStore.getState().prevChapter()
    expect(useBibleStore.getState().currentPassage).toEqual({ bookNumber: 1, chapter: 1, verse: 1 })
  })
})

describe('retry()', () => {
  it('resets error and re-initializes', async () => {
    useBibleStore.setState({ error: 'old error', isInitialized: true })
    mockLoadBibleVersionMeta.mockResolvedValue(undefined)
    mockFetchVersions.mockResolvedValue([VERSION_1])
    mockLoadBibleContent.mockResolvedValue([makeBook(1)])

    await useBibleStore.getState().retry()

    const s = useBibleStore.getState()
    expect(s.error).toBeNull()
    expect(s.isInitialized).toBe(true)
  })
})

describe('getCurrentBook() / getCurrentChapter() / getCurrentVerses()', () => {
  it('returns undefined when no content is loaded', () => {
    expect(useBibleStore.getState().getCurrentBook()).toBeUndefined()
    expect(useBibleStore.getState().getCurrentChapter()).toBeUndefined()
    expect(useBibleStore.getState().getCurrentVerses()).toEqual([])
  })

  it('returns correct book/chapter/verses when content is loaded', () => {
    const book = makeBook(1, 3, 5)
    useBibleStore.setState({
      versions: [VERSION_1],
      content: new Map([[1, [book]]]),
      currentPassage: { bookNumber: 1, chapter: 2, verse: 1 }
    })

    expect(useBibleStore.getState().getCurrentBook()).toEqual(book)
    expect(useBibleStore.getState().getCurrentChapter()).toEqual(book.chapters[1])
    expect(useBibleStore.getState().getCurrentVerses()).toEqual(book.chapters[1].verses)
  })
})

describe('persist: nothing is persisted (currentPassage is runtime state)', () => {
  it('does not persist currentPassage or any other state to localStorage', () => {
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
      length: 0,
      key: (i: number) => Object.keys(store)[i] ?? null
    })

    useBibleStore.getState().navigateTo({ bookNumber: 5, chapter: 3, verse: 2 })
    const raw = localStorage.getItem('hhc-bible')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.state).toEqual({})
    expect(parsed.state).not.toHaveProperty('currentPassage')
    expect(parsed.state).not.toHaveProperty('isLoading')
    expect(parsed.state).not.toHaveProperty('content')
    expect(parsed.state).not.toHaveProperty('versions')

    vi.unstubAllGlobals()
  })
})
