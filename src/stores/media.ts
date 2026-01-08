import { useFolderStore } from './folder'
import type { FileItem } from '@/types/common'
import { StorageCategory, StorageKey } from '@/types/common'

export const useMediaStore = () => {
  const useStore = useFolderStore<FileItem>({
    rootId: 'media-root',
    defaultRootName: 'Media Library',
    storageCategory: StorageCategory.MEDIA,
    storageKey: StorageKey.FOLDERS,
  })
  return useStore()
}
