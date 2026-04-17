import { createFolderContextMenu } from '@renderer/lib/createFolderContextMenu'
import type { VerseItem } from '@shared/types/folder'

export type {
  ClipboardState,
  UseFolderContextMenu,
  ShowItemMenuOptions,
  ShowFolderMenuOptions,
  ShowMultiSelectMenuOptions,
  ShowEmptyAreaMenuOptions
} from '@renderer/lib/createFolderContextMenu'

export const useFolderContextMenu = createFolderContextMenu<VerseItem>()
