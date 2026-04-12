import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import type { VerseItem } from '@shared/types/folder'

const makeVerse = (id: string, bookNumber = 1, chapter = 1, verseStart = 1): VerseItem => ({
  id,
  type: 'verse',
  folderId: 'root',
  bookCode: 'Gen',
  bookName: 'Genesis',
  bookNumber,
  chapter,
  verseStart,
  verseEnd: verseStart,
  text: `Verse ${id}`,
  versionCode: 'KJV',
  versionName: 'King James',
  createdAt: Date.now()
})

beforeEach(() => {
  useBibleHistoryStore.setState({ items: [] })
})

describe('initial state', () => {
  it('starts with empty items', () => {
    expect(useBibleHistoryStore.getState().items).toEqual([])
  })
})

describe('addToHistory()', () => {
  it('adds an entry', () => {
    const verse = makeVerse('v1')
    useBibleHistoryStore.getState().addToHistory(verse)
    expect(useBibleHistoryStore.getState().items).toHaveLength(1)
    expect(useBibleHistoryStore.getState().items[0]).toEqual(verse)
  })

  it('prepends new entry to the front', () => {
    const v1 = makeVerse('v1')
    const v2 = makeVerse('v2')
    useBibleHistoryStore.getState().addToHistory(v1)
    useBibleHistoryStore.getState().addToHistory(v2)
    expect(useBibleHistoryStore.getState().items[0].id).toBe('v2')
    expect(useBibleHistoryStore.getState().items[1].id).toBe('v1')
  })

  it('deduplicates: same id moves to front rather than duplicating', () => {
    const v1 = makeVerse('v1')
    const v2 = makeVerse('v2')
    useBibleHistoryStore.getState().addToHistory(v1)
    useBibleHistoryStore.getState().addToHistory(v2)
    useBibleHistoryStore.getState().addToHistory(v1)
    const items = useBibleHistoryStore.getState().items
    expect(items).toHaveLength(2)
    expect(items[0].id).toBe('v1')
    expect(items[1].id).toBe('v2')
  })

  it('enforces max limit of 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      useBibleHistoryStore.getState().addToHistory(makeVerse(`v${i}`))
    }
    expect(useBibleHistoryStore.getState().items).toHaveLength(50)
  })

  it('keeps most recent entries when limit exceeded', () => {
    for (let i = 0; i < 52; i++) {
      useBibleHistoryStore.getState().addToHistory(makeVerse(`v${i}`))
    }
    const items = useBibleHistoryStore.getState().items
    expect(items[0].id).toBe('v51')
    expect(items[49].id).toBe('v2')
  })
})

describe('removeFromHistory()', () => {
  it('removes entry by id', () => {
    useBibleHistoryStore.getState().addToHistory(makeVerse('v1'))
    useBibleHistoryStore.getState().addToHistory(makeVerse('v2'))
    useBibleHistoryStore.getState().removeFromHistory('v1')
    const items = useBibleHistoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('v2')
  })

  it('is a no-op when id does not exist', () => {
    useBibleHistoryStore.getState().addToHistory(makeVerse('v1'))
    useBibleHistoryStore.getState().removeFromHistory('nonexistent')
    expect(useBibleHistoryStore.getState().items).toHaveLength(1)
  })
})

describe('clearHistory()', () => {
  it('empties all items', () => {
    useBibleHistoryStore.getState().addToHistory(makeVerse('v1'))
    useBibleHistoryStore.getState().addToHistory(makeVerse('v2'))
    useBibleHistoryStore.getState().clearHistory()
    expect(useBibleHistoryStore.getState().items).toEqual([])
  })
})

describe('persistence round-trip', () => {
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    localStorageMock = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] ?? null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value
      },
      removeItem: (key: string) => {
        delete localStorageMock[key]
      },
      clear: () => {
        localStorageMock = {}
      },
      length: 0,
      key: (index: number) => Object.keys(localStorageMock)[index] ?? null
    })
    useBibleHistoryStore.setState({ items: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists items to localStorage with hhc-bible-history key', () => {
    const verse = makeVerse('v1')
    useBibleHistoryStore.getState().addToHistory(verse)
    const raw = localStorage.getItem('hhc-bible-history')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.version).toBe(0)
    expect(parsed.state.items).toHaveLength(1)
    expect(parsed.state.items[0].id).toBe('v1')
  })

  it('restores items from localStorage on rehydrate', () => {
    const verse = makeVerse('v2')
    localStorageMock['hhc-bible-history'] = JSON.stringify({
      state: { items: [verse] },
      version: 0
    })
    useBibleHistoryStore.persist.rehydrate()
    const items = useBibleHistoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('v2')
  })

  it('returns empty items when key missing from localStorage', () => {
    delete localStorageMock['hhc-bible-history']
    useBibleHistoryStore.persist.rehydrate()
    expect(useBibleHistoryStore.getState().items).toEqual([])
  })
})
