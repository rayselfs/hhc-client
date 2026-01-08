import { ref, watch, onUnmounted } from 'vue'
import type { FileItem } from '@/types/common'
import { useIndexedDB } from './useIndexedDB'
import { MEDIA_DB_CONFIG } from '@/config/db'

/**
 * Composable for managing thumbnail display
 * Handles fetching Blob from IndexedDB and creating Object URLs
 */
export function useThumbnail(item: FileItem) {
  const thumbnailSrc = ref<string | undefined>(item.metadata.thumbnail)
  const db = useIndexedDB(MEDIA_DB_CONFIG)
  let currentObjectURL: string | null = null

  const releaseObjectURL = () => {
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL)
      currentObjectURL = null
    }
  }

  const loadThumbnail = async () => {
    if (item.metadata.thumbnailType === 'blob' && item.metadata.thumbnailBlobId) {
      try {
        const result = await db.get<{ blob: Blob }>('thumbnails', item.metadata.thumbnailBlobId)
        if (result && result.blob) {
          releaseObjectURL()
          currentObjectURL = URL.createObjectURL(result.blob)
          thumbnailSrc.value = currentObjectURL
        }
      } catch (error) {
        console.error('Failed to load thumbnail from IndexedDB:', error)
      }
    } else {
      thumbnailSrc.value = item.metadata.thumbnail || item.url
    }
  }

  // Load initially
  loadThumbnail()

  // Watch for changes (e.g., if item is updated)
  watch(
    () => item.metadata.thumbnailBlobId,
    () => {
      loadThumbnail()
    },
  )

  // Cleanup to prevent memory leaks
  onUnmounted(() => {
    releaseObjectURL()
  })

  return {
    thumbnailSrc,
  }
}
