import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Input } from '@heroui/react'
import { Search, X } from 'lucide-react'
import { BibleSearchEngine } from '@renderer/lib/bible-search'
import { useBibleStore } from '@renderer/stores/bible'
import type { BibleBook } from '@shared/types/bible'
import { BIBLE_BOOKS } from '@shared/types/bible'

interface SearchResult {
  verseId: number
  bookNumber: number
  chapter: number
  verse: number
  bookName: string
  text: string
}

const searchEngine = new BibleSearchEngine()

function buildVerseLookup(books: BibleBook[]): Map<number, SearchResult> {
  const map = new Map<number, SearchResult>()
  for (const book of books) {
    const bookConfig = BIBLE_BOOKS.find((b) => b.number === book.number)
    const bookName = bookConfig?.name ?? book.name
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        map.set(verse.id, {
          verseId: verse.id,
          bookNumber: book.number,
          chapter: chapter.number,
          verse: verse.number,
          bookName,
          text: verse.text
        })
      }
    }
  }
  return map
}

export default function BibleSearchBar(): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isIndexReady, setIsIndexReady] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const verseLookupRef = useRef<Map<number, SearchResult>>(new Map())

  const versions = useBibleStore((state) => state.versions)
  const content = useBibleStore((state) => state.content)

  useEffect(() => {
    const versionId = versions.length > 0 ? versions[0].id : ''
    const books = content.get(versionId)
    if (!books || books.length === 0) return

    let cancelled = false

    const run = async (): Promise<void> => {
      try {
        await searchEngine.init()
        if (cancelled) return

        const verses = []
        for (const book of books) {
          for (const chapter of book.chapters) {
            for (const verse of chapter.verses) {
              verses.push({ id: verse.id, text: verse.text })
            }
          }
        }

        verseLookupRef.current = buildVerseLookup(books)
        await searchEngine.buildIndex(verses)
        if (!cancelled) setIsIndexReady(true)
      } catch {
        // intentionally silent — UI shows '索引建立中...' until ready
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [versions, content])

  useEffect(() => {
    if (!isExpanded) return

    const handleMouseDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
        setQuery('')
        setResults([])
        setHasSearched(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isExpanded])

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        const input = inputWrapperRef.current?.querySelector('input')
        input?.focus()
      }, 50)
    }
  }, [isExpanded])

  const doSearch = useCallback(
    async (q: string): Promise<void> => {
      if (!q.trim()) {
        setResults([])
        setHasSearched(false)
        return
      }

      if (!isIndexReady) {
        setHasSearched(true)
        return
      }

      setIsSearching(true)
      setHasSearched(true)

      try {
        const ids = await searchEngine.search(q)
        const mapped: SearchResult[] = ids
          .map((id) => verseLookupRef.current.get(id))
          .filter((r): r is SearchResult => r !== undefined)
        setResults(mapped)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [isIndexReady]
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
      setIsExpanded(false)
      setQuery('')
      setResults([])
      setHasSearched(false)
    }
  }

  const handleSelect = (result: SearchResult): void => {
    useBibleStore.getState().navigateTo({
      bookNumber: result.bookNumber,
      chapter: result.chapter,
      verse: result.verse
    })
    setIsExpanded(false)
    setQuery('')
    setResults([])
    setHasSearched(false)
  }

  const handleToggle = (): void => {
    if (isExpanded) {
      setIsExpanded(false)
      setQuery('')
      setResults([])
      setHasSearched(false)
    } else {
      setIsExpanded(true)
    }
  }

  const showDropdown = isExpanded && hasSearched

  const dropdownContent = (): React.ReactNode => {
    if (!isIndexReady) {
      return <div className="px-3 py-2 text-sm text-default-400">索引建立中...</div>
    }
    if (isSearching) {
      return <div className="px-3 py-2 text-sm text-default-400">搜尋中...</div>
    }
    if (results.length === 0) {
      return <div className="px-3 py-2 text-sm text-default-400">無結果</div>
    }
    return results.map((r) => (
      <button
        key={r.verseId}
        type="button"
        className="w-full text-left px-3 py-2 hover:bg-default-100 focus:bg-default-100 focus:outline-none transition-colors"
        onMouseDown={(e) => {
          e.preventDefault()
          handleSelect(r)
        }}
      >
        <div className="text-xs font-medium text-primary mb-0.5">
          {r.bookName} {r.chapter}:{r.verse}
        </div>
        <div className="text-sm text-default-700 truncate">{r.text}</div>
      </button>
    ))
  }

  return (
    <div ref={containerRef} className="relative flex items-center" data-testid="bible-search-bar">
      {isExpanded && (
        <div ref={inputWrapperRef} className="relative mr-1">
          <Input
            data-bible-search
            placeholder="搜尋經文..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-52"
            aria-label="搜尋經文"
          />
          {query.length > 0 && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-default-400 hover:text-default-600"
              onMouseDown={(e) => {
                e.preventDefault()
                setQuery('')
                setResults([])
                setHasSearched(false)
              }}
              aria-label="清除搜尋"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <Button
        size="sm"
        isIconOnly
        variant={isExpanded ? 'ghost' : 'tertiary'}
        onPress={handleToggle}
        aria-label={isExpanded ? '關閉搜尋' : '搜尋經文'}
      >
        <Search size={16} />
      </Button>

      {showDropdown && (
        <div
          className="absolute top-full right-0 mt-1 w-72 bg-content1 border border-divider rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
          role="listbox"
          aria-label="搜尋結果"
        >
          {dropdownContent()}
        </div>
      )}
    </div>
  )
}
