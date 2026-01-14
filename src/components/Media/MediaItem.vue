<template>
  <div
    class="media-item user-select-none d-flex flex-column align-center transition-swing rounded-lg position-relative pa-3"
    :class="[
      { 'item-cut': isCut },
      { 'is-dragging': isDragging },
      { 'drag-zone-center': dragZone === 'center' },
      { 'item-selected': isSelected },
    ]"
    :data-id="item.id"
    :style="{ width: '100%' }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Content: Thumbnail (File) or Large Icon (Folder) -->
    <div
      class="icon-container mb-2 rounded overflow-hidden d-flex align-center justify-center pt-2"
      :style="{ width: '100%', 'aspect-ratio': '1' }"
    >
      <!-- Folder: Large Icon -->
      <v-icon v-if="isFolder" icon="mdi-folder" :size="folderIconSize" class="folder-icon"></v-icon>

      <!-- File: Thumbnail -->
      <MediaThumbnail
        v-else
        :item="item as FileItem"
        :fallback-icon="fileIcon"
        class="rounded-lg elevation-1"
      >
        <template #placeholder>
          <div class="d-flex align-center justify-center h-100 w-100">
            <v-icon
              :icon="fileIcon"
              size="64"
              :color="isSelected ? 'white' : isPdf ? 'red' : 'grey'"
            ></v-icon>
          </div>
        </template>
      </MediaThumbnail>
    </div>

    <!-- Footer: Name -->
    <div class="name-container w-100 text-center px-1 pb-1">
      <span class="item-name text-caption line-clamp-2" :title="item.name">
        {{ item.name }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Folder, FileItem } from '@/types/common'
import MediaThumbnail from './MediaThumbnail.vue'

type UnifiedItem = FileItem | Folder<FileItem>

const props = defineProps<{
  item: UnifiedItem
  isSelected: boolean
  isCut: boolean
  isDragging?: boolean
  size: number
}>()

// helpers
const isFolder = computed(() => 'children' in props.item || !('metadata' in props.item))
const isPdf = computed(
  () => !isFolder.value && (props.item as FileItem).metadata?.fileType === 'pdf',
)

const fileIcon = computed(() => {
  if (isFolder.value) return 'mdi-folder'
  const type = (props.item as FileItem).metadata?.fileType
  switch (type) {
    case 'image':
      return 'mdi-image'
    case 'video':
      return 'mdi-file-video'
    case 'pdf':
      return 'mdi-file-pdf-box'
    default:
      return 'mdi-file'
  }
})

const folderIconSize = computed(() => props.size * 0.9)

// Drag Zone Logic
const dragZone = ref<'center' | null>(null)

const onDragOver = (e: DragEvent) => {
  if (props.isDragging) return
  if (!isFolder.value) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const width = rect.width
  const percent = x / width

  if (percent > 0.2 && percent < 0.8) {
    dragZone.value = 'center'
  } else {
    dragZone.value = null
  }
}

const onDragLeave = () => {
  dragZone.value = null
}

const onDrop = () => {
  dragZone.value = null
}
</script>

<style scoped>
.media-item {
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: transparent;
  border: 1px solid transparent;
}

.media-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.folder-icon {
  color: rgba(var(--v-theme-primary));
}

.item-selected {
  background-color: rgba(var(--v-theme-primary), 0.2) !important;
  border: 1px solid rgba(var(--v-theme-primary), 0.3) !important;
}

.item-cut {
  opacity: 0.5;
}

.is-dragging {
  opacity: 0.4 !important;
  transform: scale(0.95);
}

.icon-container {
  transition: transform 0.2s ease;
}

.media-item:hover .icon-container {
  transform: translateY(-2px);
}

.item-name {
  color: inherit;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.75rem !important;
  line-height: 1rem;
}

/* Drop Zone Styles */
:global(.media-item.drag-zone-center) {
  background-color: rgba(var(--v-theme-primary), 0.3) !important;
  border: 1px solid rgb(var(--v-theme-primary)) !important;
  transform: scale(1.05);
}
</style>
