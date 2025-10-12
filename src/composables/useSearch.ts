import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useSearch() {
  const { t: $t } = useI18n()

  // 搜尋狀態
  const searchQuery = ref('')
  const isSearching = ref(false)

  // 根據頁面類型獲取搜尋占位符
  const getSearchPlaceholder = (pageType: string) => {
    switch (pageType) {
      case 'bible':
        return $t('searchBible')
      case 'media':
        return $t('searchFiles')
      default:
        return $t('search')
    }
  }

  // 根據頁面類型執行搜尋邏輯
  const executeSearch = (pageType: string, query: string) => {
    switch (pageType) {
      case 'bible':
        // 聖經搜尋邏輯（預留）
        console.log('Bible search:', query)
        break
      case 'media':
        // 多媒體搜尋邏輯（已實現）
        console.log('Media search:', query)
        break
      case 'timer':
        // 計時器頁面不支援搜尋
        break
      default:
        console.log('Unknown page search:', query)
    }
  }

  // 開始搜尋
  const startSearch = () => {
    isSearching.value = true
  }

  // 關閉搜尋
  const closeSearch = () => {
    isSearching.value = false
    searchQuery.value = ''
  }

  // 清除搜尋
  const clearSearch = () => {
    searchQuery.value = ''
  }

  // 是否有搜尋查詢
  const hasSearchQuery = computed(() => {
    return searchQuery.value.trim().length > 0
  })

  return {
    searchQuery,
    isSearching,
    getSearchPlaceholder,
    executeSearch,
    startSearch,
    closeSearch,
    clearSearch,
    hasSearchQuery,
  }
}
