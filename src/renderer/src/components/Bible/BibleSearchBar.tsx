import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search } from 'lucide-react'
import { searchEngine, lookupVerseById } from '@renderer/lib/bible-search-singleton'
import { useBibleSearchStore } from '@renderer/stores/bible-search'

export default function BibleSearchBar(): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isIndexReady = useBibleSearchStore((state) => state.isIndexReady)

  const {
    setSearchMode,
    setIsSearching,
    setQuery: setStoreQuery,
    setResults,
    clearSearch
  } = useBibleSearchStore.getState()

  const collapse = useCallback(
    (clear = true): void => {
      setIsExpanded(false)
      setQuery('')
      if (clear) clearSearch()
    },
    [clearSearch]
  )

  const doSearch = useCallback(
    async (q: string): Promise<void> => {
      const trimmed = q.trim()
      if (!trimmed) {
        collapse()
        return
      }

      setSearchMode(true)
      setStoreQuery(trimmed)

      if (!isIndexReady) {
        setIsSearching(false)
        setResults([])
        collapse(false)
        return
      }

      setIsSearching(true)
      collapse(false)

      try {
        const ids = await searchEngine.search(trimmed)
        const mapped = ids.map((id) => lookupVerseById(id)).filter((r) => r !== undefined)
        setResults(mapped)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [isIndexReady, collapse, setSearchMode, setStoreQuery, setIsSearching, setResults]
  )

  const handleSubmit = useCallback((): void => {
    void doSearch(query)
  }, [query, doSearch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      collapse()
    }
  }

  const handleToggle = (): void => {
    if (isExpanded) {
      collapse()
    } else {
      setIsExpanded(true)
    }
  }

  useEffect(() => {
    if (!isExpanded) return
    const timer = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(timer)
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return
    const handleMouseDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        collapse()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isExpanded, collapse])

  return (
    <div
      ref={containerRef}
      data-testid="bible-search-bar"
      className={`relative flex items-center transition-all duration-250 ease-in-out overflow-hidden rounded-full border ${
        isExpanded ? 'w-64 border-border bg-transparent' : 'w-10 border-border bg-transparent'
      }`}
    >
      {isExpanded && (
        <input
          ref={inputRef}
          data-bible-search
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜尋經文..."
          aria-label="搜尋經文"
          className="flex-1 h-10 bg-transparent text-sm text-foreground pl-4 pr-1 outline-none placeholder:text-muted-fg"
        />
      )}
      <button
        type="button"
        onClick={isExpanded ? handleSubmit : handleToggle}
        aria-label={isExpanded ? '送出搜尋' : '搜尋經文'}
        className="shrink-0 flex items-center justify-center w-10 h-10 text-muted-fg hover:text-foreground transition-colors"
      >
        <Search size={16} />
      </button>
    </div>
  )
}
