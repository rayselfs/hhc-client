import { ref, computed, type Ref } from 'vue'
import type { Folder, FileItem } from '@/types/common'

export type SortBy = 'name' | 'date' | 'custom'
export type SortOrder = 'asc' | 'desc'

export function useMediaSort(folders: Ref<Folder<FileItem>[]>, items: Ref<FileItem[]>) {
  // const { t } = useI18n()

  const sortBy = ref<SortBy>('name')
  const sortOrder = ref<SortOrder>('asc')

  const setSort = (type: 'name' | 'date') => {
    if (sortBy.value === type) {
      // Toggle order if clicking same sort type
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = type
      sortOrder.value = 'asc'
    }
  }

  const sortedFolders = computed(() => {
    if (sortBy.value === 'custom') return folders.value
    return [...folders.value].sort((a, b) => {
      if (sortBy.value === 'date') {
        const timeA = a.timestamp || 0
        const timeB = b.timestamp || 0
        return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA
      }
      // Defaults to name sort
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
  })

  const sortedItems = computed(() => {
    if (sortBy.value === 'custom') return items.value
    return [...items.value].sort((a, b) => {
      if (sortBy.value === 'date') {
        const timeA = a.timestamp || 0
        const timeB = b.timestamp || 0
        return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA
      }
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
  })

  return {
    sortBy,
    sortOrder,
    setSort,
    sortedFolders,
    sortedItems,
  }
}
