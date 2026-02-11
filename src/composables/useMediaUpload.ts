import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'

import { useSentry } from '@/composables/useSentry'
import { FOLDER_DB_CONFIG } from '@/config/db'
import { useFileSystem } from '@/composables/useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useElectron } from '@/composables/useElectron'
import { useSnackBar } from '@/composables/useSnackBar'
import { useSettingsStore } from '@/stores/settings'
import { processPdfFile } from '@/composables/usePdfProcessing'
import type { FileItem } from '@/types/common'
import { FolderDBStore } from '@/types/enum'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import { VIDEO_EXTENSIONS, NON_NATIVE_VIDEO_EXTENSIONS } from '@/config/media'

function isVideoExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return VIDEO_EXTENSIONS.includes(ext)
}

function isNonNativeVideoExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return NON_NATIVE_VIDEO_EXTENSIONS.includes(ext)
}

interface UseMediaUploadOptions {
  isNameExists: (name: string, type: 'folder' | 'file') => boolean
  getUniqueName: (originalName: string, type: 'folder' | 'file') => string
  addItemToCurrent: (item: FileItem) => void
  addFolderToCurrent: (name: string, expiresAt: number | null) => void
  addItemToFolder: (folderId: string, item: FileItem) => void
  getCurrentFolders: () => { id: string; name: string }[]
  currentFolderPath: () => string[]
}

export function useMediaUpload(options: UseMediaUploadOptions) {
  const { t } = useI18n()
  const fileSystem = useFileSystem()
  const db = useIndexedDB(FOLDER_DB_CONFIG)
  const { showSnackBar } = useSnackBar()
  const { isElectron, ffmpegCheckStatus } = useElectron()
  const settingsStore = useSettingsStore()

  const fileInput = ref<HTMLInputElement | null>(null)
  const folderInput = ref<HTMLInputElement | null>(null)

  const uploadFile = () => {
    fileInput.value?.click()
  }

  const uploadFolder = () => {
    folderInput.value?.click()
  }

  const processFileMetadata = async (file: File, newItem: FileItem): Promise<void> => {
    if (!fileSystem.isElectron.value) return

    try {
      const filePathSource = fileSystem.getFilePath(file)
      if (!filePathSource) return

      const result = await fileSystem.saveFile(filePathSource)
      if (!result.success || !result.data) return

      newItem.url = result.data.fileUrl

      if (result.data.videoMetadata) {
        newItem.metadata.duration = result.data.videoMetadata.duration
        newItem.metadata.mimeType = result.data.videoMetadata.mimeType
      }

      if (result.data.thumbnailData) {
        const blob = new Blob([result.data.thumbnailData.buffer as ArrayBuffer], {
          type: 'image/jpeg',
        })
        await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
          id: newItem.id,
          blob,
          createdAt: Date.now(),
        })
        newItem.metadata.thumbnailType = 'blob'
        newItem.metadata.thumbnailBlobId = newItem.id
      }

      if (newItem.metadata.fileType === 'pdf') {
        try {
          const pdfResult = await processPdfFile(newItem.url)
          newItem.metadata.pageCount = pdfResult.pageCount

          if (pdfResult.thumbnail) {
            await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
              id: newItem.id,
              blob: pdfResult.thumbnail,
              createdAt: Date.now(),
            })
            newItem.metadata.thumbnailType = 'blob'
            newItem.metadata.thumbnailBlobId = newItem.id
          }
        } catch (pdfError) {
          console.warn('Failed to process PDF:', pdfError)
        }
      }
    } catch (error) {
      const { reportError } = useSentry()
      reportError(error, {
        operation: 'save-file-electron',
        component: 'useMediaUpload',
        extra: { fileName: file.name, fileType: newItem.metadata.fileType },
      })
    }
  }

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    for (const file of Array.from(input.files)) {
      let fileType: FileItem['metadata']['fileType']
      if (file.type.startsWith('image/')) {
        fileType = 'image'
      } else if (file.type.startsWith('video/') || isVideoExtension(file.name)) {
        fileType = 'video'

        if (isNonNativeVideoExtension(file.name) && isElectron()) {
          if (!settingsStore.isFfmpegEnabled) {
            showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
            continue
          }
          const status = await ffmpegCheckStatus()
          if (!status.available) {
            showSnackBar(t('fileExplorer.ffmpegNotAvailable'), { color: 'error' })
            continue
          }
        }
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf'
      } else {
        continue
      }

      try {
        const currentPath = options.currentFolderPath()
        const lastPathItem = currentPath[currentPath.length - 1]
        const parentFolderId: string =
          currentPath.length > 0 && lastPathItem ? lastPathItem : 'root'

        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          folderId: parentFolderId,
          name: options.getUniqueName(file.name, 'file'),
          url: URL.createObjectURL(file),
          size: file.size,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          metadata: {
            fileType,
            mimeType: file.type,
          },
          sourceType: 'local',
          permissions: { ...DEFAULT_LOCAL_PERMISSIONS },
        }

        if (fileSystem.isElectron.value) {
          await processFileMetadata(file, newItem)
        } else {
          showSnackBar(t('fileExplorer.uploadWebWarning'), {
            color: 'warning',
          })
        }

        options.addItemToCurrent(newItem)
      } catch (error) {
        const { reportError } = useSentry()
        reportError(error, {
          operation: 'process-file-upload',
          component: 'useMediaUpload',
          extra: { fileName: file.name },
        })
        showSnackBar(t('fileExplorer.uploadFailed'), {
          color: 'error',
        })
      }
    }
    input.value = ''
  }

  const handleFolderUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    const firstPath = input.files[0]?.webkitRelativePath
    if (!firstPath) return

    const rootFolderName = firstPath.split('/')[0]
    if (!rootFolderName) return

    const finalFolderName = options.getUniqueName(rootFolderName, 'folder')
    const oneDay = 24 * 60 * 60 * 1000
    options.addFolderToCurrent(finalFolderName, Date.now() + oneDay)

    const createdFolder = options.getCurrentFolders().find((f) => f.name === finalFolderName)
    if (!createdFolder) {
      const { reportError } = useSentry()
      reportError(new Error('Failed to create folder'), {
        operation: 'folder-upload',
        component: 'useMediaUpload',
        extra: { finalFolderName },
      })
      return
    }

    for (const file of Array.from(input.files)) {
      if (file.name.startsWith('.')) continue

      let fileType: FileItem['metadata']['fileType']
      if (file.type.startsWith('image/')) fileType = 'image'
      else if (file.type.startsWith('video/') || isVideoExtension(file.name)) {
        fileType = 'video'

        if (isNonNativeVideoExtension(file.name) && isElectron()) {
          if (!settingsStore.isFfmpegEnabled) {
            showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
            continue
          }
          const status = await ffmpegCheckStatus()
          if (!status.available) {
            showSnackBar(t('fileExplorer.ffmpegNotAvailable'), { color: 'error' })
            continue
          }
        }
      } else if (file.type === 'application/pdf') fileType = 'pdf'
      else continue

      try {
        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          folderId: createdFolder.id,
          name: file.name,
          url: URL.createObjectURL(file),
          size: file.size,
          timestamp: Date.now(),
          metadata: { fileType, mimeType: file.type },
          sourceType: 'local',
          permissions: { ...DEFAULT_LOCAL_PERMISSIONS },
        }

        if (fileSystem.isElectron.value) {
          await processFileMetadata(file, newItem)
        }

        options.addItemToFolder(createdFolder.id, newItem)
      } catch (e) {
        const { reportError } = useSentry()
        reportError(e, {
          operation: 'process-folder-file-upload',
          component: 'useMediaUpload',
          extra: { fileName: file.name, folderId: createdFolder.id },
        })
      }
    }
    input.value = ''
  }

  return {
    fileInput,
    folderInput,
    uploadFile,
    uploadFolder,
    handleFileChange,
    handleFolderUpload,
  }
}
