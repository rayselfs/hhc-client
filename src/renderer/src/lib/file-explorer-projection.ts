import type { AnyItemRecord, FileItemRecord } from '@shared/types/folder'
import {
  resolveFolderDisplay,
  useFileExplorerStore,
  useFileExplorerSettings,
  useFileExplorerCustomOrder
} from '@renderer/stores/file-explorer'
import { useSettingsStore } from '@renderer/stores/settings'
import { compareByField } from './file-explorer-sort'
import { groupItemsByDate } from './file-explorer-grouping'
import { getProjectionPlaylist, getPresentableItems } from './presentability'

export function getExplorerProjectionPlaylist(
  items: AnyItemRecord[],
  requestedItem?: FileItemRecord,
  folderId = requestedItem?.parentId ?? items[0]?.parentId
): FileItemRecord[] {
  if (!folderId) return []
  const settings = useFileExplorerSettings.getState()
  const display = resolveFolderDisplay(
    folderId,
    useFileExplorerStore.getState().folders,
    settings,
    settings.folderDisplay[folderId]
  )
  if (display.groupMode !== 'date') return getProjectionPlaylist(items, requestedItem)
  const timezone = useSettingsStore.getState().timezone
  const customOrder = useFileExplorerCustomOrder.getState().orders[folderId] ?? []
  const positions = new Map(customOrder.map((id, index) => [id, index]))
  const files = getPresentableItems(items).sort((a, b) =>
    display.sortDir !== 'none'
      ? compareByField(a, b, display.sortField, display.sortDir)
      : (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity) ||
        a.sortIndex - b.sortIndex
  )
  const ordered = groupItemsByDate(files, timezone, display.groupSortDir)
  return getProjectionPlaylist(ordered, requestedItem, undefined, timezone)
}
