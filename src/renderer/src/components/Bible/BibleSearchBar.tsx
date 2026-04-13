import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@heroui/react'
import { Search, X } from 'lucide-react'
import { searchEngine, lookupVerseById } from '@renderer/lib/bible-search-singleton'
import { useBibleSearchStore } from '@renderer/stores/bible-search'

export default function BibleSearchBar(): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)

  const isIndexReady = useBibleSearchStore((state) => state.isIndexReady)

  const {
    setSearchMode,
    setIsSearching,
    setQuery: setStoreQuery,
    setResults,
    clearSearch
  } = useBibleSearchStore.getState()

  const collapse = useCallback((): void => {
    setIsExpanded(false)
    setQuery('')
    clearSearch()
  }, [clearSearch])

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

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        const input = inputWrapperRef.current?.querySelector('input')
        input?.focus()
      }, 250)
    }
  }, [isExpanded])

  const doSearch = useCallback(
    async (q: string): Promise<void> => {
      if (!q.trim()) {
        clearSearch()
        setStoreQuery('')
        return
      }

      setSearchMode(true)
      setStoreQuery(q)

      if (!isIndexReady) {
        setIsSearching(false)
        setResults([])
        return
      }

      setIsSearching(true)

      try {
        const ids = await searchEngine.search(q)
        const mapped = ids.map((id) => lookupVerseById(id)).filter((r) => r !== undefined)
        setResults(mapped)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [isIndexReady, clearSearch, setSearchMode, setStoreQuery, setIsSearching, setResults]
  )

  const handleQueryChange = (value: string): void => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(value)
    }, 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
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

  return (
    <div ref={containerRef} className="relative flex items-center" data-testid="bible-search-bar">
      <div
        ref={inputWrapperRef}
        className={`relative transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanded ? 'w-52 opacity-100 mr-1' : 'w-0 opacity-0'
        }`}
      >
        <input
          data-bible-search
          type="text"
          placeholder="搜尋經文..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="搜尋經文"
          className="w-full h-8 rounded-md bg-default-100 text-foreground text-sm px-3 pr-7 border border-default-200 outline-none focus:border-primary focus:bg-default-50 placeholder:text-default-400 transition-colors"
        />
        {query.length > 0 && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-default-400 hover:text-default-600"
            onMouseDown={(e) => {
              e.preventDefault()
              setQuery('')
              clearSearch()
            }}
            aria-label="清除搜尋"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <Button
        size="sm"
        isIconOnly
        variant={isExpanded ? 'ghost' : 'tertiary'}
        onPress={handleToggle}
        aria-label={isExpanded ? '關閉搜尋' : '搜尋經文'}
      >
        <Search size={16} />
      </Button>
    </div>
  )
}
