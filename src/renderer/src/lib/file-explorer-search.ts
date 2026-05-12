import type { FileItemRecord } from '@shared/types/folder'
import type { FolderStoreState } from '@renderer/stores/folder'

export interface SearchResult {
  item: FileItemRecord
  folderPath: string
}

export function searchAllItems(query: string, storeState: FolderStoreState): SearchResult[] {
  if (query.trim() === '') return []

  const lowerQuery = query.toLowerCase()
  const results: SearchResult[] = []

  for (const record of storeState._itemsArray) {
    if (record.type !== 'file') continue
    if (!record.name.toLowerCase().includes(lowerQuery)) continue

    const item = record as FileItemRecord
    const pathFolders = storeState.getFolderPath(item.parentId)
    const folderPath = ['Files', ...pathFolders.map((f) => f.name)].join(' > ')

    results.push({ item, folderPath })

    if (results.length >= 20) break
  }

  return results
}
