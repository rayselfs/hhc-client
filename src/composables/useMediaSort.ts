import { ref, computed, type Ref } from 'vue'
import type { Folder, FileItem } from '@/types/common'

export type SortBy = 'name' | 'date' | 'type' | 'custom'
export type SortOrder = 'asc' | 'desc'

export function useMediaSort(folders: Ref<Folder<FileItem>[]>, items: Ref<FileItem[]>) {
  // const { t } = useI18n()

  const sortBy = ref<SortBy>('name')
  const sortOrder = ref<SortOrder>('asc')

  const setSort = (type: SortBy) => {
    if (type === 'custom') {
      sortBy.value = 'custom'
      return
    }

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
      // For type sort, folders are all same type, so match name sort
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
      if (sortBy.value === 'type') {
        const typeA = a.metadata?.fileType || ''
        const typeB = b.metadata?.fileType || ''
        const typeCompare = typeA.localeCompare(typeB)
        if (typeCompare !== 0) {
          return sortOrder.value === 'asc' ? typeCompare : -typeCompare // Reverse type order? usually keep asc for groups
        }
        // Fallback to name
        return a.name.localeCompare(b.name)
      }
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
  })

  const sortedUnifiedItems = computed(() => {
    // For 'type' sort, we want to mix folders and files together based on their type
    // For all other sorts (name, date, custom), we keep folders first (Standard behavior)
    if (sortBy.value === 'type') {
      const allItems = [...folders.value, ...items.value]
      return allItems.sort((a, b) => {
        const typeA = 'items' in a ? 'folder' : a.metadata?.fileType || 'unknown'
        const typeB = 'items' in b ? 'folder' : b.metadata?.fileType || 'unknown'

        const typeCompare = typeA.localeCompare(typeB)
        if (typeCompare !== 0) {
          return sortOrder.value === 'asc' ? typeCompare : -typeCompare
        }
        // Fallback to name
        return sortOrder.value === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      })
    }

    // Default: Folders First
    return [...sortedFolders.value, ...sortedItems.value]
  })

  return {
    sortBy,
    sortOrder,
    setSort,
    sortedFolders,
    sortedItems,
    sortedUnifiedItems,
  }
}
