import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { searchAllItems } from '@renderer/lib/file-explorer-search'
import { getFileIcon } from '@renderer/components/Control/FileExplorer/views/getFileIcon'
import type { SearchResult } from '@renderer/lib/file-explorer-search'
import SearchBar from './SearchBar'

export default function FileExplorerSearchBar(): React.JSX.Element {
  const { t } = useTranslation()
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback((query: string): void => {
    const found = searchAllItems(query, useFileExplorerStore.getState())
    setResults(found)
    setHasSearched(true)
  }, [])

  const handleClear = useCallback((): void => {
    setResults([])
    setHasSearched(false)
  }, [])

  const handleResultClick = useCallback((result: SearchResult): void => {
    void useFileExplorerStore.getState().navigateToFolder(result.item.parentId)
    setResults([])
    setHasSearched(false)
  }, [])

  const dropdown =
    hasSearched ? (
      <div className="max-h-[300px] overflow-y-auto rounded-md border border-default-200 bg-content1 shadow-lg">
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
    ) : null

  return (
    <SearchBar
      onSearch={handleSearch}
      onClear={handleClear}
      placeholder={t('fileExplorer.search.placeholder')}
      submitLabel={t('fileExplorer.search.placeholder')}
      renderDropdown={dropdown}
    />
  )
}
