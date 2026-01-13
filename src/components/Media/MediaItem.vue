<template>
  <v-card
    variant="flat"
    :color="isSelected ? 'primary' : undefined"
    :ripple="false"
    class="media-item user-select-none d-flex flex-column transition-swing rounded-lg position-relative"
    :class="[
      { 'item-cut': isCut },
      { 'is-dragging': isDragging },
      { 'drag-zone-center': dragZone === 'center' },
    ]"
    :data-id="item.id"
    :style="{ width: '100%', height: '100%' }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Header: Icon & Name -->
    <div class="d-flex align-center px-3 py-2 w-100 overflow-hidden">
      <!-- Folder Icon or File Type Icon -->
      <v-icon
        :icon="headerIcon"
        :color="headerIconColor"
        size="small"
        class="mr-2 flex-shrink-0"
      ></v-icon>

      <span class="text-truncate flex-grow-1" style="min-width: 0" :title="item.name">
        {{ item.name }}
      </span>

      <!-- Context Menu Trigger -->
      <v-btn
        icon="mdi-dots-vertical"
        variant="text"
        density="compact"
        size="small"
        :color="isSelected ? 'white' : ''"
        class="flex-shrink-0"
        @click.stop="$emit('menu-click', item, $event)"
      ></v-btn>
    </div>

    <!-- Content: Thumbnail (File) or Large Icon (Folder) -->
    <div
      class="flex-grow-1 mx-2 mb-2 rounded overflow-hidden position-relative d-flex align-center justify-center"
      :class="isSelected ? 'bg-primary-darken-1' : 'bg-surface'"
      style="aspect-ratio: 1"
    >
      <!-- Folder: Large Icon -->
      <v-icon
        v-if="isFolder"
        icon="mdi-folder"
        size="64"
        :color="dragZone === 'center' ? 'primary' : 'grey-lighten-1'"
      ></v-icon>

      <!-- File: Thumbnail -->
      <MediaThumbnail
        v-else
        :item="item as FileItem"
        aspect-ratio="1"
        :fallback-icon="fileIcon"
        class="h-100 w-100 bg-transparent"
        cover
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
  </v-card>
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
}>()

defineEmits<{
  (e: 'menu-click', item: UnifiedItem, event: MouseEvent): void
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

const headerIcon = computed(() => (isFolder.value ? 'mdi-folder' : fileIcon.value))
const headerIconColor = computed(() => {
  if (props.isSelected) return 'white'
  if (isFolder.value) return undefined
  return 'red' // Default file icon color in header
})

// Drag Zone Logic
const dragZone = ref<'center' | null>(null)

const onDragOver = (e: DragEvent) => {
  if (props.isDragging) return

  // Only Folders support "Drop Into" (Center Zone)
  // Files don't accept drops (nesting), they only support Reorder (handled by List swap)
  // BUT: if we drag a File over a File, we don't need highlighting. Visual swap handles it.
  // So style logic is mainly for Folder Nesting.

  if (!isFolder.value) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const width = rect.width
  const percent = x / width

  // Center 60% = Nest
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
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.5, 1);
  border: 1px solid transparent;
}

.item-cut {
  opacity: 0.5;
}

.is-dragging {
  opacity: 0.4 !important;
  transform: scale(0.95);
}

/* Drop Zone Styles */
:global(.media-item.drag-zone-center) {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  background-color: rgba(var(--v-theme-primary), 0.15) !important;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
}
</style>
