import { createFolderContextMenu } from '@renderer/lib/createFolderContextMenu'

export type {
  ClipboardState,
  UseFolderContextMenu,
  ShowItemMenuOptions,
  ShowFolderMenuOptions,
  ShowMultiSelectMenuOptions,
  ShowEmptyAreaMenuOptions
} from '@renderer/lib/createFolderContextMenu'

export const useFolderContextMenu = createFolderContextMenu()
