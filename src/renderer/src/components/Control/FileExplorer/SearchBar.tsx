import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { searchAllItems } from '@renderer/lib/file-explorer-search'
import { getFileIcon } from '@renderer/components/Control/FileExplorer/views/getFileIcon'
import type { SearchResult } from '@renderer/lib/file-explorer-search'

interface SearchBarProps {
  className?: string
}

export function SearchBar({ className }: SearchBarProps): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback((q: string) => {
    if (q.trim() === '') {
      setResults([])
      setOpen(false)
      return
    }
    const found = searchAllItems(q, useFileExplorerStore.getState())
    setResults(found)
    setOpen(true)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => runSearch(val), 200)
    },
    [runSearch]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('')
      setResults([])
      setOpen(false)
    }
  }, [])

  const handleResultClick = useCallback((result: SearchResult) => {
    useFileExplorerStore.getState().navigateToFolder(result.item.parentId)
    setQuery('')
    setResults([])
    setOpen(false)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative${className ? ` ${className}` : ''}`}>
      <div className="flex items-center gap-2 rounded-md border border-default-200 bg-default-100 px-3 py-1.5">
        <Search size={14} className="shrink-0 text-default-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('fileExplorer.search.placeholder')}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-default-400"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto rounded-md border border-default-200 bg-content1 shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-default-400">
              {t('fileExplorer.search.noResults')}
            </div>
          ) : (
            results.map((result) => (
              <button
                key={result.item.id}
                type="button"
                onClick={() => handleResultClick(result)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-default-100 focus:bg-default-100 focus:outline-none"
              >
                <span className="shrink-0 text-default-500">
                  {getFileIcon(result.item.mimeType, false, 16)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{result.item.name}</span>
                <span className="shrink-0 truncate text-xs text-default-400">
                  {result.folderPath}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
