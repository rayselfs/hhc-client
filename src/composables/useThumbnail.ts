import { ref, watch, onUnmounted, unref } from 'vue'
import type { Ref } from 'vue'
import type { FileItem } from '@/types/common'
import { useIndexedDB } from './useIndexedDB'
import { useSentry } from '@/composables/useSentry'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { FolderDBStore } from '@/types/enum'

/**
 * Composable for managing thumbnail display
 * Handles fetching Blob from IndexedDB and creating Object URLs
 */
export function useThumbnail(itemOrRef: FileItem | Ref<FileItem>) {
  const thumbnailSrc = ref<string | undefined>(unref(itemOrRef).metadata?.thumbnailUrl)
  const db = useIndexedDB(FOLDER_DB_CONFIG)
  let currentObjectURL: string | null = null

  const releaseObjectURL = () => {
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL)
      currentObjectURL = null
    }
  }

  const loadThumbnail = async () => {
    const item = unref(itemOrRef)
    if (!item) return

    if (item.metadata?.thumbnailType === 'blob' && item.metadata?.thumbnailBlobId) {
      try {
        const result = await db.get<{ blob: Blob }>(
          FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
          item.metadata.thumbnailBlobId,
        )
        if (result && result.blob) {
          releaseObjectURL()
          currentObjectURL = URL.createObjectURL(result.blob)
          thumbnailSrc.value = currentObjectURL
        }
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'load-thumbnail-from-indexeddb',
          component: 'useThumbnail',
          extra: { itemId: item.id },
        })
      }
    } else {
      thumbnailSrc.value = item.metadata?.thumbnailUrl
    }
  }

  // Load initially
  loadThumbnail()

  // Watch for changes: explicitly watch the itemOrRef
  // If it's a ref, this triggers when the object works
  // If it's a static object, we deep watch properties or rely on the caller to pass a Ref
  watch(
    () => {
      const item = unref(itemOrRef)
      return {
        id: item.id,
        blobId: item.metadata?.thumbnailBlobId,
        url: item.metadata?.thumbnailUrl,
      }
    },
    () => {
      loadThumbnail()
    },
    { deep: true },
  )

  // Cleanup to prevent memory leaks
  onUnmounted(() => {
    releaseObjectURL()
  })

  return {
    thumbnailSrc,
  }
}
