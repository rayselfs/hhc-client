import type { FolderRecord } from '@shared/types/folder'

export function getReadOnlySyncAncestor(
  folderId: string,
  folders: Record<string, FolderRecord>
): FolderRecord | null {
  let current: FolderRecord | undefined = folders[folderId]
  const seen = new Set<string>()

  while (current && !seen.has(current.id)) {
    if (current.syncLink) return current
    seen.add(current.id)
    current = current.parentId ? folders[current.parentId] : undefined
  }

  return null
}

export function isFolderReadOnlyBySyncLink(
  folderId: string,
  folders: Record<string, FolderRecord>
): boolean {
  return getReadOnlySyncAncestor(folderId, folders) !== null
}
