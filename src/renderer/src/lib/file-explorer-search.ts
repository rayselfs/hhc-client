import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import type { FolderStoreState } from '@renderer/stores/folder'

export type SearchResult =
  | { kind: 'file'; item: FileItemRecord; folderPath: string }
  | { kind: 'folder'; folder: FolderRecord; folderPath: string }

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

    results.push({ kind: 'file', item, folderPath })

    if (results.length >= 20) break
  }

  if (results.length < 20) {
    for (const folder of storeState._foldersArray) {
      if (folder.parentId === null) continue
      if (!folder.name.toLowerCase().includes(lowerQuery)) continue

      const pathFolders = storeState.getFolderPath(folder.parentId)
      const folderPath = ['Files', ...pathFolders.map((f) => f.name)].join(' > ')

      results.push({ kind: 'folder', folder, folderPath })

      if (results.length >= 20) break
    }
  }

  return results
}
