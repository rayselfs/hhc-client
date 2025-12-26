import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useMediaStore } from '@/stores/media'
import { useElectron } from '@/composables/useElectron'
import { useSnackBar } from '@/composables/useSnackBar'
import type { FileItem, Folder } from '@/types/common'

export const useMediaUpload = () => {
  const { t } = useI18n()
  const mediaStore = useMediaStore()
  const { getCurrentFolders, getCurrentItems } = storeToRefs(mediaStore)
  const { isElectron, getFilePath, saveFile } = useElectron()
  const { showSnackBar } = useSnackBar()

  const fileInput = ref<HTMLInputElement | null>(null)
  const folderInput = ref<HTMLInputElement | null>(null)

  const uploadFile = () => {
    fileInput.value?.click()
  }

  const uploadFolder = () => {
    folderInput.value?.click()
  }

  const isNameExists = (name: string, type: 'folder' | 'file') => {
    if (type === 'folder') {
      return getCurrentFolders.value.some((f: Folder<FileItem>) => f.name === name)
    }
    return getCurrentItems.value.some((i: FileItem) => i.name === name)
  }

  const getUniqueName = (originalName: string, type: 'folder' | 'file') => {
    let name = originalName
    let ext = ''

    if (type === 'file') {
      const lastDotIndex = name.lastIndexOf('.')
      if (lastDotIndex !== -1) {
        ext = name.substring(lastDotIndex)
        name = name.substring(0, lastDotIndex)
      }
    }

    let finalName = originalName
    let counter = 2

    while (isNameExists(finalName, type)) {
      finalName = `${name} ${counter}${ext}`
      counter++
    }

    return finalName
  }

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    for (const file of Array.from(input.files)) {
      // Validate file type
      let fileType: FileItem['metadata']['fileType']
      if (file.type.startsWith('image/')) {
        fileType = 'image'
      } else if (file.type.startsWith('video/')) {
        fileType = 'video'
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf'
      } else {
        // Skip unsupported files
        continue
      }

      try {
        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          name: getUniqueName(file.name, 'file'),
          url: URL.createObjectURL(file), // Default to blob URL for web
          size: file.size,
          timestamp: Date.now(),
          // User Request: Uploaded file should have 1 day retention
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          metadata: {
            fileType,
            mimeType: file.type,
          },
        }

        // If in Electron, save file to persistent storage
        if (isElectron()) {
          try {
            const filePathSource = getFilePath(file)

            if (filePathSource) {
              const { filePath, thumbnailPath } = await saveFile(filePathSource)
              newItem.url = `local-resource://${filePath}`

              if (thumbnailPath) {
                newItem.metadata.thumbnail = `local-resource://${thumbnailPath}`
              }
            }
          } catch (error) {
            console.error('Failed to save file in Electron:', error)
          }
        } else {
          showSnackBar(t('fileExplorer.uploadWebWarning'), 'warning', 5000)
        }

        mediaStore.addItemToCurrent(newItem)
      } catch (error) {
        console.error('Failed to process file:', file.name, error)
        showSnackBar(t('fileExplorer.uploadFailed'), 'error')
      }
    }

    // Reset input
    input.value = ''
  }

  const handleFolderUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    // Get directory name from the first file's webkitRelativePath
    const firstPath = input.files[0]?.webkitRelativePath
    if (!firstPath) return

    const rootFolderName = firstPath.split('/')[0]
    if (!rootFolderName) return

    // Handle Name Collision
    const finalFolderName = getUniqueName(rootFolderName, 'folder')

    // Create Root Folder
    const oneDay = 24 * 60 * 60 * 1000
    mediaStore.addFolderToCurrent(finalFolderName, Date.now() + oneDay)

    // Find the folder we just added to get its ID
    const createdFolder = getCurrentFolders.value.find(
      (f: Folder<FileItem>) => f.name === finalFolderName,
    )
    if (!createdFolder) {
      console.error('Failed to create folder')
      return
    }

    // Upload Files
    for (const file of Array.from(input.files)) {
      if (file.name.startsWith('.')) continue

      let fileType: FileItem['metadata']['fileType']
      if (file.type.startsWith('image/')) fileType = 'image'
      else if (file.type.startsWith('video/')) fileType = 'video'
      else if (file.type === 'application/pdf') fileType = 'pdf'
      else continue

      try {
        const newItem: FileItem = {
          id: uuidv4(),
          type: 'file',
          name: file.name,
          url: URL.createObjectURL(file),
          size: file.size,
          timestamp: Date.now(),
          metadata: { fileType, mimeType: file.type },
        }

        if (isElectron()) {
          try {
            const filePathSource = getFilePath(file)
            if (filePathSource) {
              const { filePath, thumbnailPath } = await saveFile(filePathSource)
              newItem.url = `local-resource://${filePath}`
              if (thumbnailPath) newItem.metadata.thumbnail = `local-resource://${thumbnailPath}`
            }
          } catch (e) {
            console.error(e)
          }
        }

        // Add to the NEW folder
        mediaStore.addItemToFolder(createdFolder.id, newItem)
      } catch (e) {
        console.error(e)
      }
    }

    // Reset
    input.value = ''
  }

  return {
    fileInput,
    folderInput,
    uploadFile,
    uploadFolder,
    handleFileChange,
    handleFolderUpload,
    getUniqueName,
    isNameExists,
  }
}
