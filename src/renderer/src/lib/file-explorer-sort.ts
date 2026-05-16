import { formatFileKind } from '@renderer/lib/format-file-kind'
import type { SortField } from '@renderer/stores/file-explorer'

export interface SortableItem {
  name: string
  size?: number
  createdAt?: number
  mimeType?: string
  isFolder?: boolean
}

export function compareByField(
  a: SortableItem,
  b: SortableItem,
  field: SortField,
  dir: 'asc' | 'desc'
): number {
  const sign = dir === 'asc' ? 1 : -1
  switch (field) {
    case 'name':
      return sign * a.name.localeCompare(b.name)
    case 'createdAt':
      return sign * ((a.createdAt ?? 0) - (b.createdAt ?? 0))
    case 'size':
      return sign * ((a.size ?? 0) - (b.size ?? 0))
    case 'kind': {
      const ka = formatFileKind(a.mimeType, a.isFolder ?? false)
      const kb = formatFileKind(b.mimeType, b.isFolder ?? false)
      return sign * ka.localeCompare(kb)
    }
  }
}
