import { storeToRefs } from 'pinia'

import { useSettingsStore } from '@/stores/settings'
import type { FileItem } from '@/types/folder'
import { NON_NATIVE_VIDEO_EXTENSIONS } from '@/config/media'

function isNonNativeVideoExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return NON_NATIVE_VIDEO_EXTENSIONS.includes(ext)
}

export function useMediaProcessing() {
  const settingsStore = useSettingsStore()
  const { isFfmpegEnabled } = storeToRefs(settingsStore)

  const canProjectItem = (item: FileItem): boolean => {
    if (item.metadata.fileType === 'image' || item.metadata.fileType === 'pdf') {
      return true
    }

    if (item.metadata.fileType === 'video' && isNonNativeVideoExtension(item.name)) {
      return isFfmpegEnabled.value
    }

    return true
  }

  return {
    canProjectItem,
    isFfmpegEnabled,
    updateFfmpegStatus: settingsStore.updateFfmpegStatus,
  }
}
