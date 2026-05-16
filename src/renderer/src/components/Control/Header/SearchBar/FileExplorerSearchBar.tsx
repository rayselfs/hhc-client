import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFileExplorerSearch } from '@renderer/stores/file-explorer'
import SearchBar from './SearchBar'

export default function FileExplorerSearchBar(): React.JSX.Element {
  const { t } = useTranslation()
  const setSearchQuery = useFileExplorerSearch((state) => state.setSearchQuery)

  const handleSearch = useCallback(
    (query: string): void => {
      setSearchQuery(query)
    },
    [setSearchQuery]
  )

  const handleClear = useCallback((): void => {
    setSearchQuery('')
  }, [setSearchQuery])

  return (
    <SearchBar
      onSearch={handleSearch}
      onClear={handleClear}
      placeholder={t('fileExplorer.search.placeholder')}
      submitLabel={t('fileExplorer.search.placeholder')}
    />
  )
}
