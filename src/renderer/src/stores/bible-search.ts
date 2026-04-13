import { create } from 'zustand'

export interface BibleSearchResult {
  verseId: number
  bookNumber: number
  chapter: number
  verse: number
  text: string
}

export interface BibleSearchStore {
  isSearchMode: boolean
  isSearching: boolean
  isIndexReady: boolean
  query: string
  results: BibleSearchResult[]

  setSearchMode: (active: boolean) => void
  setIsSearching: (searching: boolean) => void
  setIndexReady: (ready: boolean) => void
  setQuery: (query: string) => void
  setResults: (results: BibleSearchResult[]) => void
  clearSearch: () => void
}

export const useBibleSearchStore = create<BibleSearchStore>()((set) => ({
  isSearchMode: false,
  isSearching: false,
  isIndexReady: false,
  query: '',
  results: [],

  setSearchMode: (active) => set({ isSearchMode: active }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setIndexReady: (ready) => set({ isIndexReady: ready }),
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  clearSearch: () => set({ isSearchMode: false, isSearching: false, query: '', results: [] })
}))
