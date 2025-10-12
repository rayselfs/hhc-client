<template>
  <div class="file-explorer">
    <!-- 麵包屑導航 -->
    <div v-if="breadcrumbs.length > 1" class="mb-4">
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

    <!-- 網格檢視 -->
    <div
      v-if="viewMode === 'grid' && (files.length > 0 || folders.length > 0)"
      class="grid-view"
      @click="handleEmptyAreaClick"
    >
      <!-- 資料夾區域 -->
      <div v-if="folders.length > 0" class="folders-section">
        <div class="folders-grid">
          <v-card
            v-for="folder in folders"
            :key="folder.id"
            class="folder-card"
            :class="{ 'folder-selected': isFolderSelected(folder.id) }"
            elevation="1"
            hover
            draggable="true"
            @click.stop="handleFolderClick(folder.id, $event)"
            @dblclick.stop="handleFolderEnter(folder.id)"
            @dragstart="handleFolderDragStart(folder.id, $event)"
            @dragend="handleFolderDragEnd"
            @dragover.prevent="handleFolderDragOver(folder.id, $event)"
            @dragleave="handleFolderDragLeave(folder.id, $event)"
            @drop.prevent="handleFolderDrop(folder.id, $event)"
          >
            <v-card-text class="pt-4 pb-4 pl-2 pr-2">
              <div class="folder-content">
                <v-icon icon="mdi-folder" size="40" color="grey-darken-1" class="folder-icon" />
                <div class="folder-info">
                  <div class="text-subtitle-1 text-truncate" :title="folder.name">
                    {{ folder.name }}
                  </div>
                </div>
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      class="flex-shrink-0"
                      v-bind="props"
                      @click.stop
                    >
                      <v-icon icon="mdi-dots-vertical" size="16" />
                    </v-btn>
                  </template>
                  <v-list>
                    <v-list-item @click="handleFolderMove(folder.id)">
                      <template #prepend>
                        <v-icon icon="mdi-folder-move" />
                      </template>
                      <v-list-item-title>{{ $t('move') }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="handleFolderDelete(folder.id)">
                      <template #prepend>
                        <v-icon icon="mdi-delete" />
                      </template>
                      <v-list-item-title>{{ $t('delete') }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <!-- 文件區域 -->
      <div v-if="files.length > 0" class="files-section">
        <div class="files-grid">
          <v-card
            v-for="file in files"
            :key="file.id"
            class="file-card"
            :class="{ 'file-selected': isFileSelected(file.id) }"
            elevation="1"
            hover
            draggable="true"
            @click.stop="handleFileClick(file, $event)"
            @dblclick.stop="handlePreview(file)"
            @dragstart="handleFileDragStart(file.id, $event)"
            @dragend="handleFileDragEnd"
          >
            <!-- File Header with Icon and Name -->
            <div class="file-header pa-2">
              <div class="file-icon-name">
                <v-icon
                  :icon="getFileTypeIcon(file.type)"
                  size="20"
                  :color="getFileTypeColor(file.type)"
                  class="mr-2"
                />
                <div class="text-subtitle-2 text-truncate" :title="file.name">{{ file.name }}</div>
              </div>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    class="flex-shrink-0"
                    v-bind="props"
                    @click.stop
                  >
                    <v-icon icon="mdi-dots-vertical" size="16" />
                  </v-btn>
                </template>
                <v-list>
                  <v-list-item @click="handleFileMove(file.id)">
                    <template #prepend>
                      <v-icon icon="mdi-folder-move" />
                    </template>
                    <v-list-item-title>{{ $t('move') }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="handleDelete(file.id)">
                    <template #prepend>
                      <v-icon icon="mdi-delete" />
                    </template>
                    <v-list-item-title>{{ $t('delete') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>

            <!-- File Preview Area -->
            <div class="file-preview">
              <!-- File not found status -->
              <div v-if="file.status === 'not-found'" class="file-not-found">
                <v-icon icon="mdi-file-alert" size="32" color="warning" />
                <div class="text-caption text-warning mt-1">Not Found</div>
              </div>
              <!-- Checking status -->
              <div v-else-if="file.status === 'checking'" class="file-checking">
                <v-progress-circular indeterminate size="24" />
                <div class="text-caption text-medium-emphasis mt-1">Checking...</div>
              </div>
              <!-- Normal status -->
              <template v-else>
                <img
                  v-if="file.thumbnail"
                  :src="file.thumbnail"
                  :alt="file.name"
                  class="file-thumbnail"
                />
                <div v-else class="file-icon-container">
                  <v-icon
                    :icon="getFileIcon(file.type)"
                    size="32"
                    :color="getFileColor(file.type)"
                  />
                </div>
              </template>
            </div>
          </v-card>
        </div>
      </div>
    </div>

    <!-- 清單檢視 -->
    <div
      v-else-if="viewMode === 'list' && (files.length > 0 || folders.length > 0)"
      class="list-view"
      @click="handleEmptyAreaClick"
    >
      <v-list class="transparent-list">
        <!-- 資料夾 -->
        <template v-for="(folder, index) in folders" :key="folder.id">
          <v-list-item
            @click.stop="handleFolderClick(folder.id, $event as MouseEvent)"
            @dblclick.stop="handleFolderEnter(folder.id)"
            :class="{ 'folder-selected': isFolderSelected(folder.id) }"
            class="folder-list-item"
            draggable="true"
            @dragstart="handleFolderDragStart(folder.id, $event)"
            @dragend="handleFolderDragEnd"
            @dragover.prevent="handleFolderDragOver(folder.id, $event)"
            @dragleave="handleFolderDragLeave(folder.id, $event)"
            @drop.prevent="handleFolderDrop(folder.id, $event)"
          >
            <template #prepend>
              <v-icon icon="mdi-folder" color="primary" />
            </template>
            <v-list-item-title>{{ folder.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ $t('folder') }}</v-list-item-subtitle>
            <template #append>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    v-bind="props"
                    @click.stop
                  />
                </template>
                <v-list>
                  <v-list-item @click="handleFolderDelete(folder.id)">
                    <template #prepend>
                      <v-icon icon="mdi-delete" color="error" />
                    </template>
                    <v-list-item-title>{{ $t('delete') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-list-item>
          <v-divider v-if="index < folders.length - 1 || files.length > 0" />
        </template>

        <!-- 文件 -->
        <template v-for="(file, index) in files" :key="file.id">
          <v-list-item
            @click.stop="handleFileClick(file, $event as MouseEvent)"
            @dblclick.stop="handlePreview(file)"
            :class="{ 'file-selected': isFileSelected(file.id) }"
            class="file-list-item"
            draggable="true"
            @dragstart="handleFileDragStart(file.id, $event)"
            @dragend="handleFileDragEnd"
          >
            <template #prepend>
              <v-icon :icon="getFileIcon(file.type)" :color="getFileColor(file.type)" />
            </template>
            <v-list-item-title>{{ file.name }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ formatFileSize(file.size) }} • {{ formatDate(file.lastModified) }}
            </v-list-item-subtitle>
            <template #append>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    v-bind="props"
                    @click.stop
                  />
                </template>
                <v-list>
                  <v-list-item @click="handlePreview(file)">
                    <template #prepend>
                      <v-icon icon="mdi-eye" />
                    </template>
                    <v-list-item-title>{{ $t('preview') }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="handleDelete(file.id)">
                    <template #prepend>
                      <v-icon icon="mdi-delete" color="error" />
                    </template>
                    <v-list-item-title>{{ $t('delete') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-list-item>
          <v-divider v-if="index < files.length - 1" />
        </template>
      </v-list>
    </div>

    <!-- 空狀態 -->
    <div v-else class="empty-state">
      <v-icon size="64">mdi-folder-open-outline</v-icon>
      <p class="text-h6 mt-4">{{ $t('media.noFiles') }}</p>
    </div>

    <v-overlay :model-value="loading" contained class="align-center justify-center">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="text-h6 text-white mt-4">{{ $t('uploadingFiles') }}</p>
    </v-overlay>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

interface FileItem {
  id: string
  name: string
  size: number
  type: string
  lastModified: Date
  url?: string
  thumbnail?: string
  folderId: string
  status?: 'valid' | 'not-found' | 'checking'
}

interface FolderItem {
  id: string
  name: string
  parentId: string
  createdAt: Date
}

interface Props {
  files: FileItem[]
  folders: FolderItem[]
  loading: boolean
  viewMode: 'grid' | 'list'
  currentFolder: string
  selectedFiles: string[]
  selectedFolders: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'upload', files: File[]): void
  (e: 'delete', fileId: string): void
  (e: 'preview', file: FileItem): void
  (e: 'folderClick', folderId: string): void
  (e: 'backFolder'): void
  (e: 'navigateToFolder', folderId: string): void
  (e: 'fileSelect', fileId: string, event: MouseEvent): void
  (e: 'fileDeselect', fileId: string): void
  (e: 'clearSelection'): void
  (e: 'folderSelect', folderId: string, event: MouseEvent): void
  (e: 'folderDeselect', folderId: string): void
  (e: 'folderDelete', folderId: string): void
  (e: 'folderEnter', folderId: string): void
  (e: 'folderMove', folderId: string): void
  (e: 'fileMove', fileId: string): void
  (e: 'fileMoveToFolder', fileId: string, targetFolderId: string): void
  (e: 'folderMoveToFolder', folderId: string, targetFolderId: string): void
}>()

// 麵包屑項目類型
interface BreadcrumbItem {
  title: string
  icon?: string
  folderId: string
  disabled: boolean
}

// 麵包屑計算
const breadcrumbs = computed((): BreadcrumbItem[] => {
  const crumbs: BreadcrumbItem[] = []

  // 添加根目錄
  crumbs.push({
    title: $t('homepage'),
    icon: 'mdi-home',
    folderId: 'root',
    disabled: props.currentFolder === 'root',
  })

  // 如果不在根目錄，添加路徑
  if (props.currentFolder !== 'root') {
    const path = getFolderPath(props.currentFolder)
    path.forEach((folder) => {
      crumbs.push({
        title: folder.name,
        icon: 'mdi-folder',
        folderId: folder.id,
        disabled: props.currentFolder === folder.id,
      })
    })
  }

  return crumbs
})

// 獲取資料夾路徑
const getFolderPath = (folderId: string): FolderItem[] => {
  const path: FolderItem[] = []
  let currentId = folderId

  while (currentId && currentId !== 'root') {
    const folder = props.folders.find((f: FolderItem) => f.id === currentId)
    if (folder) {
      path.unshift(folder) // 添加到開頭
      currentId = folder.parentId
    } else {
      break
    }
  }

  return path
}

// 處理麵包屑點擊
const handleBreadcrumbClick = (item: BreadcrumbItem) => {
  if (!item.disabled) {
    emit('navigateToFolder', item.folderId)
  }
}

// 檢查資料夾是否被選取
const isFolderSelected = (folderId: string): boolean => {
  return props.selectedFolders.includes(folderId)
}

// 處理資料夾點擊（選取/取消選取）
const handleFolderClick = (folderId: string, event: MouseEvent) => {
  emit('folderSelect', folderId, event)
}

// 處理資料夾進入（雙擊）
const handleFolderEnter = (folderId: string) => {
  emit('folderEnter', folderId)
}

// 處理資料夾移動
const handleFolderMove = (folderId: string) => {
  emit('folderMove', folderId)
}

// 處理資料夾刪除
const handleFolderDelete = (folderId: string) => {
  emit('folderDelete', folderId)
}

// 處理預覽
const handlePreview = (file: FileItem) => {
  emit('preview', file)
}

// 處理檔案移動
const handleFileMove = (fileId: string) => {
  emit('fileMove', fileId)
}

// 處理刪除
const handleDelete = (fileId: string) => {
  emit('delete', fileId)
}

// 檢查檔案是否被選取
const isFileSelected = (fileId: string): boolean => {
  return props.selectedFiles.includes(fileId)
}

// 處理檔案點擊（選取/取消選取）
const handleFileClick = (file: FileItem, event: MouseEvent) => {
  emit('fileSelect', file.id, event)
}

// 處理空白區域點擊（取消所有選取）
const handleEmptyAreaClick = () => {
  emit('clearSelection')
}

// 處理資料夾拖拽開始
const handleFolderDragStart = (folderId: string, event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'folder',
        id: folderId,
      }),
    )
    event.dataTransfer.effectAllowed = 'move'

    // Create custom drag image for list view
    const target = event.target as HTMLElement
    const dragImage = target.cloneNode(true) as HTMLElement
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.style.left = '-1000px'
    dragImage.style.width = '200px'
    dragImage.style.backgroundColor = 'rgba(var(--v-theme-surface), 0.9)'
    dragImage.style.border = '1px solid rgba(var(--v-theme-outline), 0.2)'
    dragImage.style.borderRadius = '8px'
    dragImage.style.padding = '8px'
    dragImage.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'

    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 100, 20)

    // Clean up after a short delay
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 100)
  }
}

// 處理資料夾拖拽結束
const handleFolderDragEnd = () => {
  // Clean up if needed
}

// 處理資料夾拖拽懸停
const handleFolderDragOver = (folderId: string, event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  // Add visual feedback
  const target = event.currentTarget as HTMLElement
  target.classList.add('drag-over')
}

// 處理資料夾拖拽離開
const handleFolderDragLeave = (folderId: string, event: DragEvent) => {
  const target = event.currentTarget as HTMLElement
  target.classList.remove('drag-over')
}

// 處理資料夾拖拽放置
const handleFolderDrop = (folderId: string, event: DragEvent) => {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  target.classList.remove('drag-over')

  if (event.dataTransfer) {
    try {
      const data = JSON.parse(event.dataTransfer.getData('text/plain'))
      if (data.type === 'file') {
        emit('fileMoveToFolder', data.id, folderId)
      } else if (data.type === 'folder') {
        emit('folderMoveToFolder', data.id, folderId)
      }
    } catch (error) {
      console.error('Error parsing drag data:', error)
    }
  }
}

// 處理檔案拖拽開始
const handleFileDragStart = (fileId: string, event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'file',
        id: fileId,
      }),
    )
    event.dataTransfer.effectAllowed = 'move'

    // Create custom drag image for list view
    const target = event.target as HTMLElement
    const dragImage = target.cloneNode(true) as HTMLElement
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.style.left = '-1000px'
    dragImage.style.width = '200px'
    dragImage.style.backgroundColor = 'rgba(var(--v-theme-surface), 0.9)'
    dragImage.style.border = '1px solid rgba(var(--v-theme-outline), 0.2)'
    dragImage.style.borderRadius = '8px'
    dragImage.style.padding = '8px'
    dragImage.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'

    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 100, 20)

    // Clean up after a short delay
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 100)
  }
}

// 處理檔案拖拽結束
const handleFileDragEnd = () => {
  // Clean up if needed
}

// 獲取文件圖標
const getFileIcon = (type: string): string => {
  if (type.startsWith('image/')) return 'mdi-image'
  if (type.startsWith('video/')) return 'mdi-video'
  if (type.startsWith('audio/')) return 'mdi-music'
  if (type.includes('pdf')) return 'mdi-file-pdf-box'
  if (type.includes('word')) return 'mdi-file-word'
  if (type.includes('excel') || type.includes('spreadsheet')) return 'mdi-file-excel'
  if (type.includes('powerpoint') || type.includes('presentation')) return 'mdi-file-powerpoint'
  if (type.includes('zip') || type.includes('rar')) return 'mdi-folder-zip'
  return 'mdi-file'
}

// 獲取文件顏色
const getFileColor = (type: string): string => {
  if (type.startsWith('image/')) return 'green'
  if (type.startsWith('video/')) return 'red'
  if (type.startsWith('audio/')) return 'purple'
  if (type.includes('pdf')) return 'red'
  if (type.includes('word')) return 'blue'
  if (type.includes('excel') || type.includes('spreadsheet')) return 'green'
  if (type.includes('powerpoint') || type.includes('presentation')) return 'orange'
  if (type.includes('zip') || type.includes('rar')) return 'amber'
  return 'grey'
}

// Get file type icon for header
const getFileTypeIcon = (type: string): string => {
  if (type.startsWith('image/')) return 'mdi-image'
  if (type.startsWith('video/')) return 'mdi-video'
  if (type.includes('pdf')) return 'mdi-file-pdf-box'
  if (type.includes('youtube') || type.includes('youtu.be')) return 'mdi-youtube'
  return 'mdi-file'
}

// Get file type color for header
const getFileTypeColor = (type: string): string => {
  if (type.startsWith('image/')) return 'red'
  if (type.startsWith('video/')) return 'red'
  if (type.includes('pdf')) return 'red'
  if (type.includes('youtube') || type.includes('youtu.be')) return 'red'
  return 'grey'
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
</script>

<style scoped>
.file-explorer {
  min-height: 400px;
}

/* 網格檢視 */
.grid-view {
  padding: 16px 0;
}

/* 資料夾區域 */
.folders-section {
  margin-bottom: 32px;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

/* 文件區域 */
.files-section {
  margin-bottom: 16px;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

/* 清單檢視 */
.list-view {
  background: transparent;
}

.transparent-list {
  background: transparent !important;
}

.folder-list-item,
.file-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.folder-list-item:hover,
.file-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

/* 卡片樣式 */
.folder-card,
.file-card {
  transition: all 0.2s ease;
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.folder-card:hover,
.file-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

/* 檔案選取狀態 */
.file-selected {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.3) !important;
}

/* 資料夾選取狀態 */
.folder-selected {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.3) !important;
}

/* 資料夾內容 */
.folder-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.folder-icon {
  flex-shrink: 0;
}

.folder-info {
  flex: 1;
  min-width: 0;
}

.folder-meta {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* 文件頭部 */
.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.file-icon-name {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

/* 文件內容 */
.file-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 文件預覽 */
.file-preview {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  margin-bottom: 8px;
}

.file-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border-radius: 4px;
}

.file-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 文件信息 */
.file-name {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.file-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.file-size {
  font-weight: 500;
}

.file-date {
  opacity: 0.8;
}

/* 空狀態 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* 麵包屑樣式 */
.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover:not(.v-breadcrumbs-item--disabled) {
  color: rgb(var(--v-theme-primary));
}

/* File status styles */
.file-not-found,
.file-checking {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.file-not-found {
  color: rgb(var(--v-theme-warning));
}

.file-checking {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Drag and drop styles */
.drag-over {
  border: 2px dashed rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.1);
  transform: scale(1.02);
  transition: all 0.2s ease;
}

.folder-card.drag-over,
.file-card.drag-over {
  border: 2px dashed rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.1);
  transform: scale(1.02);
  transition: all 0.2s ease;
}

/* Responsive design */
@media (max-width: 768px) {
  .folders-grid,
  .files-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }

  .file-preview {
    height: 80px;
  }
}
</style>
