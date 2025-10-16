<template>
  <v-container
    fluid
    :class="{ 'drag-over': isDragOver }"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
    @keydown="handleKeyDown"
    tabindex="0"
  >
    <!-- Breadcrumb Navigation -->
    <div v-if="breadcrumbs.length > 0" class="mb-4">
      <v-breadcrumbs :items="breadcrumbs" class="pa-0">
        <template #item="{ item }">
          <v-breadcrumbs-item
            :disabled="item.disabled"
            @click="handleBreadcrumbClick(item as BreadcrumbItem)"
            class="breadcrumb-item"
          >
            <v-icon
              v-if="(item as BreadcrumbItem).icon"
              :icon="(item as BreadcrumbItem).icon"
              size="16"
              class="mr-1"
            />
            {{ item.title }}
          </v-breadcrumbs-item>
        </template>
        <template #divider>
          <v-icon icon="mdi-chevron-right" size="16" />
        </template>
      </v-breadcrumbs>
    </div>

    <!-- Title and Action Bar -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <!-- Left Side: Selection Bar (only when items are selected) -->
          <v-card
            v-if="selectedFiles.length > 0 || selectedFolders.length > 0"
            elevation="2"
            height="40"
            width="100%"
            class="mr-1 rounded-xl"
          >
            <v-card-text class="pa-0">
              <div class="d-flex align-center">
                <v-btn icon size="small" variant="text" @click="clearSelection" class="ml-1 mr-2">
                  <v-icon icon="mdi-close" />
                </v-btn>
                <span class="text-subtitle-1 mr-2">{{
                  $t('media.selectedItems', {
                    count: selectedFiles.length + selectedFolders.length,
                  })
                }}</span>
                <v-btn icon size="small" variant="text" @click="deleteSelectedFiles">
                  <v-icon icon="mdi-delete" />
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <!-- Spacer to push right content to the right -->
          <div class="flex-grow-1"></div>

          <!-- Right Side: Action Selector and View Mode (always on the right) -->
          <div class="d-flex align-center gap-2 ma-1">
            <!-- Action Selector -->
            <v-menu width="200">
              <template #activator="{ props }">
                <v-btn variant="outlined" color="primary" v-bind="props">
                  <v-icon icon="mdi-plus" class="mr-2" />
                  {{ $t('add') }}
                  <v-icon icon="mdi-chevron-down" class="ml-2" />
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="createFolder">
                  <template #prepend>
                    <v-icon icon="mdi-folder-plus" />
                  </template>
                  <v-list-item-title>{{ $t('new') + $t('folder') }}</v-list-item-title>
                </v-list-item>
                <v-divider></v-divider>
                <v-list-item @click="triggerFileUpload">
                  <template #prepend>
                    <v-icon icon="mdi-upload" />
                  </template>
                  <v-list-item-title>{{ $t('upload') + $t('file') }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <!-- View Mode Toggle -->
            <v-btn-toggle v-model="viewMode" mandatory variant="outlined" density="compact">
              <v-btn value="grid" :title="$t('media.gridView')">
                <v-icon icon="mdi-view-grid" />
              </v-btn>
              <v-btn value="list" :title="$t('media.listView')">
                <v-icon icon="mdi-view-list" />
              </v-btn>
            </v-btn-toggle>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- File Explorer -->
    <FileExplorer
      :files="filteredFiles"
      :folders="folders.filter((folder) => folder.parentId === currentFolder)"
      :loading="loading"
      :view-mode="viewMode"
      :current-folder="currentFolder"
      :selected-files="selectedFiles"
      :selected-folders="selectedFolders"
      @upload="handleFileUpload"
      @delete="handleFileDelete"
      @preview="handleFilePreview"
      @folder-click="handleFolderClick"
      @back-folder="handleBackFolder"
      @navigate-to-folder="handleNavigateToFolder"
      @file-select="handleFileSelect"
      @file-deselect="handleFileDeselect"
      @clear-selection="clearSelection"
      @folder-select="handleFolderSelect"
      @folder-deselect="handleFolderDeselect"
      @folder-delete="handleFolderDelete"
      @folder-enter="handleFolderEnter"
      @folder-move="handleFolderMove"
      @file-move="handleFileMove"
      @file-move-to-folder="handleFileMoveToFolder"
      @folder-move-to-folder="handleFolderMoveToFolder"
    />

    <!-- Move Dialog -->
    <MoveDialog
      v-model="showMoveDialog"
      :folders="folders"
      :current-folder="currentFolder"
      :exclude-folder-id="moveTargetType === 'folder' ? moveTargetId : ''"
      @move="handleMoveConfirm"
    />

    <!-- Hidden File Input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      @change="handleFileInputChange"
      accept="image/*,video/*,.pdf"
    />

    <!-- Create Folder Dialog -->
    <v-dialog v-model="showCreateFolderDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('new') + $t('folder') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newFolderName"
            variant="outlined"
            autofocus
            @keydown.enter="confirmCreateFolder"
            @keydown.esc="cancelCreateFolder"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="cancelCreateFolder">{{ $t('cancel') }}</v-btn>
          <v-btn color="primary" @click="confirmCreateFolder" :disabled="!newFolderName.trim()">
            {{ $t('create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Files Not Found Dialog -->
    <v-dialog v-model="showNotFoundDialog" max-width="600" persistent>
      <v-card>
        <v-card-title class="text-h6">
          <v-icon icon="mdi-alert-circle" class="mr-2" color="warning" />
          {{ $t('file') + $t('notFound') }}
        </v-card-title>
        <v-card-text>
          <p class="mb-4">{{ $t('media.filesNotFoundMessage') }}</p>
          <v-list>
            <v-list-item v-for="file in notFoundFilesList" :key="file.id" class="mb-2">
              <template #prepend>
                <v-icon icon="mdi-file-alert" color="warning" />
              </template>
              <v-list-item-title>{{ file.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ getFilePath(file) }}</v-list-item-subtitle>
              <template #append>
                <div class="d-flex align-center gap-1">
                  <v-btn
                    @click="handleUploadNotFound(file)"
                    color="primary"
                    variant="text"
                    size="small"
                    icon
                  >
                    <v-icon icon="mdi-upload" size="16" />
                  </v-btn>
                  <v-btn
                    @click="handleRemoveNotFound(file)"
                    color="error"
                    variant="text"
                    size="small"
                    icon
                  >
                    <v-icon icon="mdi-delete" size="16" />
                  </v-btn>
                </div>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FileExplorer from '@/components/Media/FileExplorer.vue'
import MoveDialog from '@/components/Media/MoveDialog.vue'
import { getMediaLocalKey, STORAGE_KEYS } from '@/config/app'
import { useSentry } from '@/composables/useSentry'

const { t: $t } = useI18n()

const { reportError } = useSentry()

// Breadcrumb item type
interface BreadcrumbItem {
  title: string
  icon?: string
  folderId: string
  disabled: boolean
}

// File input reference
const fileInput = ref<HTMLInputElement>()

// Props
const props = defineProps<{
  searchQuery?: string
}>()

// State
const files = ref<FileItem[]>([])
const folders = ref<FolderItem[]>([])
const loading = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')
const currentFolder = ref<string>('root')
const isDragOver = ref(false)

// Create folder dialog state
const showCreateFolderDialog = ref(false)
const newFolderName = ref('')

// Files not found dialog state
const showNotFoundDialog = ref(false)
const notFoundFilesList = ref<FileItem[]>([])

// Move dialog state
const showMoveDialog = ref(false)
const moveTargetId = ref<string>('')
const moveTargetType = ref<'file' | 'folder'>('file')

// File selection state
const selectedFiles = ref<string[]>([])
const selectedFolders = ref<string[]>([])
const lastSelectedIndex = ref<number>(-1)
const lastSelectedFolderIndex = ref<number>(-1)

// File item interface
interface FileItem {
  id: string
  name: string
  size: number
  type: string
  lastModified: Date
  thumbnail?: string
  folderId: string
  status?: 'valid' | 'not-found' | 'checking'
  path?: string
  data?: string // Base64 encoded file data for permanent storage
}

// Folder item interface
interface FolderItem {
  id: string
  name: string
  parentId: string
  createdAt: Date
}

// Filtered file list
const filteredFiles = computed(() => {
  let result = files.value.filter((file) => file.folderId === currentFolder.value)

  if (props.searchQuery && props.searchQuery.trim()) {
    result = result.filter((file) =>
      file.name.toLowerCase().includes(props.searchQuery!.toLowerCase()),
    )
  }

  return result
})

// Breadcrumb calculation
const breadcrumbs = computed((): BreadcrumbItem[] => {
  const crumbs: BreadcrumbItem[] = []

  // Add root directory (using "Media" as title)
  crumbs.push({
    title: $t('homepage'),
    icon: 'mdi-home',
    folderId: 'root',
    disabled: currentFolder.value === 'root',
  })

  // If not in root directory, add path
  if (currentFolder.value !== 'root') {
    const path = getFolderPath(currentFolder.value)
    path.forEach((folder) => {
      crumbs.push({
        title: folder.name,
        icon: 'mdi-folder',
        folderId: folder.id,
        disabled: currentFolder.value === folder.id,
      })
    })
  }

  return crumbs
})

// Get folder path
const getFolderPath = (folderId: string): FolderItem[] => {
  const path: FolderItem[] = []
  let currentId = folderId

  while (currentId && currentId !== 'root') {
    const folder = folders.value.find((f: FolderItem) => f.id === currentId)
    if (folder) {
      path.unshift(folder) // Add to beginning
      currentId = folder.parentId
    } else {
      break
    }
  }

  return path
}

// Convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1]
      if (base64) {
        resolve(base64)
      } else {
        reject(new Error('Failed to extract base64 data'))
      }
    }
    reader.onerror = (error) => {
      reportError(error, {
        operation: 'file-reader-error',
        component: 'MediaControl',
        extra: { fileName: file.name, fileSize: file.size },
      })
      reject(error)
    }
    reader.readAsDataURL(file)
  })
}

// Create data URL from Base64 data
const createDataUrl = (data: string | undefined, mimeType: string): string => {
  if (!data) {
    throw new Error('No data provided')
  }

  // Ensure mimeType is valid
  const validMimeType = mimeType || 'application/octet-stream'

  // Create the data URL
  const dataUrl = `data:${validMimeType};base64,${data}`

  return dataUrl
}

// Trigger file upload
const triggerFileUpload = () => {
  fileInput.value?.click()
}

// Handle file input change
const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    handleFileUpload(Array.from(target.files))
  }
}

// Check file status
const checkFileStatus = async (file: FileItem) => {
  // If we have Base64 data, the file is always valid (permanently stored)
  if (file.data) {
    file.status = 'valid'
    return
  }

  // If we have path, the file is always valid (it's stored in our system)
  if (file.path) {
    file.status = 'valid'
    return
  }

  // If no data and no path, mark as not found
  file.status = 'not-found'
}

// Check all files status
const checkAllFilesStatus = async () => {
  const promises = files.value.map(checkFileStatus)
  await Promise.all(promises)

  // Check if any files are not found
  const notFoundFiles = files.value.filter((f) => f.status === 'not-found')
  if (notFoundFiles.length > 0) {
    showNotFoundDialog.value = true
    notFoundFilesList.value = notFoundFiles
  }
}

// Handle file upload
const handleFileUpload = async (uploadedFiles: File[]) => {
  loading.value = true

  try {
    for (const file of uploadedFiles) {
      // Convert file to Base64 for permanent storage
      const base64Data = await fileToBase64(file)

      const fileItem: FileItem = {
        id: generateId(),
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified),
        folderId: currentFolder.value,
        status: 'valid',
        path: file.webkitRelativePath || file.name, // Try to get relative path, fallback to name
        data: base64Data, // Store Base64 data for permanent storage
      }

      // If it's an image, generate thumbnail
      if (file.type.startsWith('image/')) {
        fileItem.thumbnail = await generateThumbnail(file)
      }

      files.value.push(fileItem)
    }

    // 保存到 localStorage
    saveFilesToStorage()
  } catch (error) {
    reportError(error, {
      operation: 'file-upload',
      component: 'MediaControl',
    })
  } finally {
    loading.value = false
  }
}

// Drag handling
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()

  // Check if this is an internal drag (file/folder move) or external file upload
  // Internal drags have specific data types, external file uploads have files
  const hasFiles = event.dataTransfer?.types.includes('Files')
  const hasTextPlain = event.dataTransfer?.types.includes('text/plain')

  // If it has files but no text/plain, it's an external file upload
  // If it has text/plain, it's likely an internal drag
  if (hasTextPlain || !hasFiles) {
    // This is an internal drag operation, don't show upload effect
    return
  }

  isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  // Check if this is an internal drag (file/folder move) or external file upload
  const dragData = event.dataTransfer?.getData('text/plain')
  if (dragData) {
    // This is an internal drag operation, ignore it
    return
  }

  const droppedFiles = event.dataTransfer?.files
  if (droppedFiles && droppedFiles.length > 0) {
    handleFileUpload(Array.from(droppedFiles))
  }
}

// Folder functions
const createFolder = () => {
  const baseName = $t('media.untitledFolder')
  const currentFolders = folders.value.filter((folder) => folder.parentId === currentFolder.value)
  const existingNames = currentFolders.map((folder) => folder.name)

  // Check if the base name exists
  let folderName = baseName
  if (existingNames.includes(baseName)) {
    // Find the next available number
    let counter = 1
    while (existingNames.includes(`${baseName} ${counter}`)) {
      counter++
    }
    folderName = `${baseName} ${counter}`
  }

  newFolderName.value = folderName
  showCreateFolderDialog.value = true
}

const confirmCreateFolder = () => {
  if (newFolderName.value.trim()) {
    const newFolder: FolderItem = {
      id: generateId(),
      name: newFolderName.value.trim(),
      parentId: currentFolder.value,
      createdAt: new Date(),
    }
    folders.value.push(newFolder)
    saveFoldersToStorage()
    showCreateFolderDialog.value = false
    newFolderName.value = ''
  }
}

const cancelCreateFolder = () => {
  showCreateFolderDialog.value = false
  newFolderName.value = ''
}

const handleFolderClick = (folderId: string) => {
  currentFolder.value = folderId
  clearSelection()
}

const handleBackFolder = () => {
  if (currentFolder.value !== 'root') {
    const currentFolderItem = folders.value.find((f) => f.id === currentFolder.value)
    if (currentFolderItem) {
      currentFolder.value = currentFolderItem.parentId
      clearSelection()
    }
  }
}

const handleNavigateToFolder = (folderId: string) => {
  currentFolder.value = folderId
  clearSelection()
}

// Get file path for display
const getFilePath = (file: FileItem): string => {
  // If we have the path, show it (this is the actual file path)
  if (file.path) {
    return file.path
  }

  // Fallback to folder path if no path
  if (file.folderId === 'root') {
    return '/'
  }

  const path = getFolderPath(file.folderId)
  const pathNames = path.map((folder) => folder.name)
  return '/' + pathNames.join('/')
}

// Handle breadcrumb click
const handleBreadcrumbClick = (item: BreadcrumbItem) => {
  if (!item.disabled) {
    currentFolder.value = item.folderId
    clearSelection()
  }
}

// Handle upload not found file
const handleUploadNotFound = (file: FileItem) => {
  // Create a file input for single file re-upload
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = false
  input.accept = 'image/*,video/*,.pdf'

  input.onchange = async (event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      const newFile = target.files[0]
      if (newFile) {
        // Use handleFileUpload to process the new file
        await handleFileUpload([newFile])

        // Remove the old file from files list
        const oldFileIndex = files.value.findIndex((f) => f.id === file.id)
        if (oldFileIndex > -1) {
          files.value.splice(oldFileIndex, 1)
        }

        // Remove from not found list
        const notFoundIndex = notFoundFilesList.value.findIndex((f) => f.id === file.id)
        if (notFoundIndex > -1) {
          notFoundFilesList.value.splice(notFoundIndex, 1)
        }

        // Close dialog if no more not found files
        if (notFoundFilesList.value.length === 0) {
          showNotFoundDialog.value = false
        }
      }
    }
  }

  input.click()
}

// Handle remove not found file
const handleRemoveNotFound = (file: FileItem) => {
  // Use handleFileDelete to remove from files list
  handleFileDelete(file.id)

  // Remove from not found list
  const notFoundIndex = notFoundFilesList.value.findIndex((f) => f.id === file.id)
  if (notFoundIndex > -1) {
    notFoundFilesList.value.splice(notFoundIndex, 1)
  }

  // Close dialog if no more not found files
  if (notFoundFilesList.value.length === 0) {
    showNotFoundDialog.value = false
  }
}

// Handle file delete
const handleFileDelete = (fileId: string) => {
  const index = files.value.findIndex((file) => file.id === fileId)
  if (index > -1) {
    files.value.splice(index, 1)
    saveFilesToStorage()
  }
}

// Handle file preview
const handleFilePreview = (file: FileItem) => {
  if (file.data) {
    try {
      const dataUrl = createDataUrl(file.data, file.type)

      // Test if the data URL is valid
      const testImg = new Image()
      testImg.onload = () => {
        // Create a new window with proper content
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${file.name}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  background: #f5f5f5;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                }
                img {
                  max-width: 100%;
                  max-height: 100vh;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                  border-radius: 8px;
                }
                .filename {
                  position: absolute;
                  top: 10px;
                  left: 10px;
                  background: rgba(0,0,0,0.7);
                  color: white;
                  padding: 8px 12px;
                  border-radius: 4px;
                  font-family: Arial, sans-serif;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="filename">${file.name}</div>
              <img src="${dataUrl}" alt="${file.name}" />
            </body>
            </html>
          `)
          newWindow.document.close()
        } else {
          alert('無法打開預覽視窗，請檢查瀏覽器彈出視窗設定')
        }
      }
      testImg.onerror = () => {
        reportError(new Error('Data URL is invalid'), {
          operation: 'preview-file',
          component: 'MediaControl',
          extra: { fileName: file.name, fileType: file.type },
        })
        alert('數據 URL 無效，無法預覽')
      }
      testImg.src = dataUrl
    } catch (error) {
      reportError(error, {
        operation: 'create-data-url',
        component: 'MediaControl',
        extra: { fileName: file.name, fileType: file.type },
      })
      alert('無法預覽檔案：' + (error instanceof Error ? error.message : String(error)))
    }
  } else {
    reportError(new Error('No data found for file'), {
      operation: 'preview-file-no-data',
      component: 'MediaControl',
      extra: { fileName: file.name },
    })

    alert('檔案數據不存在，無法預覽')
  }
}

// 生成唯一 ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// 生成縮略圖
const generateThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      const maxSize = 150
      let { width, height } = img

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height

      ctx?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }

    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// 保存文件到 localStorage
const saveFilesToStorage = () => {
  const filesToSave = files.value.map((file) => ({
    ...file,
    url: undefined, // 不保存 URL，因為會失效
    thumbnail: file.thumbnail,
  }))
  localStorage.setItem(
    getMediaLocalKey(STORAGE_KEYS.MEDIA_LOCAL.FILES),
    JSON.stringify(filesToSave),
  )
}

// Save folders to localStorage
const saveFoldersToStorage = () => {
  localStorage.setItem(
    getMediaLocalKey(STORAGE_KEYS.MEDIA_LOCAL.FOLDERS),
    JSON.stringify(folders.value),
  )
}

// Load files from localStorage
const loadFilesFromStorage = async () => {
  const saved = localStorage.getItem(getMediaLocalKey(STORAGE_KEYS.MEDIA_LOCAL.FILES))
  if (saved) {
    try {
      const parsedFiles = JSON.parse(saved)
      files.value = parsedFiles.map((file: FileItem) => ({
        ...file,
        lastModified: new Date(file.lastModified),
        status: 'valid', // Default to valid
        path: file.path || file.name, // Ensure path is preserved
        data: file.data, // Ensure data is preserved
      }))

      // Check file status after loading
      await checkAllFilesStatus()
    } catch (error) {
      reportError(error, {
        operation: 'load-files',
        component: 'MediaControl',
      })
    }
  }
}

// Load folders from localStorage
const loadFoldersFromStorage = () => {
  const saved = localStorage.getItem(getMediaLocalKey(STORAGE_KEYS.MEDIA_LOCAL.FOLDERS))
  if (saved) {
    try {
      folders.value = JSON.parse(saved)
    } catch (error) {
      reportError(error, {
        operation: 'load-folders',
        component: 'MediaControl',
      })
    }
  }
}

// Handle file selection
const handleFileSelect = (fileId: string, event: MouseEvent) => {
  const currentFiles = filteredFiles.value
  const fileIndex = currentFiles.findIndex((f) => f.id === fileId)

  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd + Click: Toggle selection
    const index = selectedFiles.value.indexOf(fileId)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    } else {
      selectedFiles.value.push(fileId)
    }
    lastSelectedIndex.value = fileIndex
  } else if (event.shiftKey && lastSelectedIndex.value !== -1) {
    // Shift + Click: Range selection
    const start = Math.min(lastSelectedIndex.value, fileIndex)
    const end = Math.max(lastSelectedIndex.value, fileIndex)
    const rangeFiles = currentFiles.slice(start, end + 1).map((f) => f.id)
    selectedFiles.value = [...new Set([...selectedFiles.value, ...rangeFiles])]
  } else {
    // Single click: Select only this file
    selectedFiles.value = [fileId]
    lastSelectedIndex.value = fileIndex
  }
}

// Handle file deselection
const handleFileDeselect = (fileId: string) => {
  const index = selectedFiles.value.indexOf(fileId)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  }
}

// Handle folder selection
const handleFolderSelect = (folderId: string, event: MouseEvent) => {
  const currentFolders = folders.value.filter((folder) => folder.parentId === currentFolder.value)
  const folderIndex = currentFolders.findIndex((f) => f.id === folderId)

  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd + Click: Toggle selection
    const index = selectedFolders.value.indexOf(folderId)
    if (index > -1) {
      selectedFolders.value.splice(index, 1)
    } else {
      selectedFolders.value.push(folderId)
    }
    lastSelectedFolderIndex.value = folderIndex
  } else if (event.shiftKey && lastSelectedFolderIndex.value !== -1) {
    // Shift + Click: Range selection
    const start = Math.min(lastSelectedFolderIndex.value, folderIndex)
    const end = Math.max(lastSelectedFolderIndex.value, folderIndex)
    const rangeFolders = currentFolders.slice(start, end + 1).map((f) => f.id)
    selectedFolders.value = [...new Set([...selectedFolders.value, ...rangeFolders])]
  } else {
    // Single click: Select only this folder
    selectedFolders.value = [folderId]
    lastSelectedFolderIndex.value = folderIndex
  }
}

// Handle folder deselection
const handleFolderDeselect = (folderId: string) => {
  const index = selectedFolders.value.indexOf(folderId)
  if (index > -1) {
    selectedFolders.value.splice(index, 1)
  }
}

// Handle folder move
const handleFolderMove = (folderId: string) => {
  moveTargetId.value = folderId
  moveTargetType.value = 'folder'
  showMoveDialog.value = true
}

// Handle file move
const handleFileMove = (fileId: string) => {
  moveTargetId.value = fileId
  moveTargetType.value = 'file'
  showMoveDialog.value = true
}

// Handle move confirmation
const handleMoveConfirm = (targetFolderId: string) => {
  if (moveTargetType.value === 'folder') {
    // Move folder
    const folder = folders.value.find((f) => f.id === moveTargetId.value)
    if (folder) {
      folder.parentId = targetFolderId
      saveFoldersToStorage()
    }
  } else {
    // Move file
    const file = files.value.find((f) => f.id === moveTargetId.value)
    if (file) {
      file.folderId = targetFolderId
      saveFilesToStorage()
    }
  }

  showMoveDialog.value = false
  moveTargetId.value = ''
}

// Handle folder delete
const handleFolderDelete = (folderId: string) => {
  const index = folders.value.findIndex((folder) => folder.id === folderId)
  if (index > -1) {
    folders.value.splice(index, 1)
    saveFoldersToStorage()
  }

  // Remove from selected folders
  const selectedIndex = selectedFolders.value.indexOf(folderId)
  if (selectedIndex > -1) {
    selectedFolders.value.splice(selectedIndex, 1)
  }
}

// Handle folder enter (double click)
const handleFolderEnter = (folderId: string) => {
  handleNavigateToFolder(folderId)
}

// Handle keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedFiles.value.length > 0 || selectedFolders.value.length > 0) {
      event.preventDefault()
      deleteSelectedFiles()
    }
  }
}

// Handle file move to folder (drag and drop)
const handleFileMoveToFolder = (fileId: string, targetFolderId: string) => {
  const file = files.value.find((f) => f.id === fileId)
  if (file) {
    file.folderId = targetFolderId
    saveFilesToStorage()
  }
}

// Handle folder move to folder (drag and drop)
const handleFolderMoveToFolder = (folderId: string, targetFolderId: string) => {
  const folder = folders.value.find((f) => f.id === folderId)
  if (folder) {
    folder.parentId = targetFolderId
    saveFoldersToStorage()
  }
}

// Clear all selections
const clearSelection = () => {
  selectedFiles.value = []
  selectedFolders.value = []
  lastSelectedIndex.value = -1
  lastSelectedFolderIndex.value = -1
}

// Delete selected files and folders
const deleteSelectedFiles = () => {
  selectedFiles.value.forEach((fileId) => {
    handleFileDelete(fileId)
  })
  selectedFolders.value.forEach((folderId) => {
    handleFolderDelete(folderId)
  })
  clearSelection()
}

onMounted(() => {
  loadFilesFromStorage()
  loadFoldersFromStorage()
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

.gap-4 {
  gap: 16px;
}

/* Breadcrumb styles */
.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover:not(.v-breadcrumbs-item--disabled) {
  color: rgb(var(--v-theme-primary));
}

.drag-over {
  background-color: rgba(var(--v-theme-primary), 0.1);
  border: 2px dashed rgb(var(--v-theme-primary));
  border-radius: 8px;
}
</style>
