import { useFolderStore } from './folder'
import type { FileItem } from '@/types/common'
import { StorageCategory, StorageKey } from '@/types/common'

export const useMediaStore = () => {
  return useFolderStore<FileItem>({
    rootId: 'media-root',
    defaultRootName: 'Media Library',
    storageCategory: StorageCategory.MEDIA,
    storageKey: StorageKey.FOLDERS,
  })
}
