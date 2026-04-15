import React, { useCallback } from 'react'
import { searchEngine, lookupVerseById } from '@renderer/lib/bible-search'
import { useBibleSearchStore } from '@renderer/stores/bible-search'
import { useTranslation } from 'react-i18next'
import SearchBar from '@renderer/components/SearchBar'

export default function BibleSearchBar(): React.JSX.Element {
  const { t } = useTranslation()
  const isIndexReady = useBibleSearchStore((s) => s.isIndexReady)

  const handleSearch = useCallback(async (query: string): Promise<void> => {
    const {
      setSearchMode,
      setIsSearching,
      setQuery,
      setResults,
      isIndexReady: ready
    } = useBibleSearchStore.getState()

    setSearchMode(true)
    setQuery(query)

    if (!ready) {
      setResults([])
      return
    }

    setIsSearching(true)

    try {
      const ids = await searchEngine.search(query)
      const mapped = ids.map((id) => lookupVerseById(id)).filter((r) => r !== undefined)
      useBibleSearchStore.getState().setResults(mapped)
    } catch {
      useBibleSearchStore.getState().setResults([])
    } finally {
      useBibleSearchStore.getState().setIsSearching(false)
    }
  }, [])

  const handleClear = useCallback((): void => {
    useBibleSearchStore.getState().clearSearch()
  }, [])

  return (
    <SearchBar
      onSearch={handleSearch}
      onClear={handleClear}
      placeholder={t('bible.search.placeholder')}
      submitLabel={t('bible.search.submit')}
      disabled={!isIndexReady}
      inputDataAttr="data-bible-search"
      testId="bible-search-bar"
    />
  )
}
