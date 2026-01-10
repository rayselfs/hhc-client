<template>
  <v-card
    variant="flat"
    :color="isSelected ? 'primary' : undefined"
    :ripple="false"
    class="file-item user-select-none d-flex flex-column h-100 position-relative transition-swing rounded-lg"
    style="aspect-ratio: 1; width: 100%"
    :class="[{ 'item-cut': isCut }, { 'is-dragging': isDragging }]"
    :data-id="item.id"
  >
    <!-- Header Info -->
    <div class="d-flex align-center px-3 py-3 w-100 overflow-hidden">
      <v-icon
        :icon="getFileIcon(item.metadata.fileType)"
        :color="isSelected ? 'white' : 'red'"
        size="small"
        class="mr-2 flex-shrink-0"
      ></v-icon>
      <span class="text-truncate flex-grow-1" style="min-width: 0" :title="item.name">{{
        item.name
      }}</span>
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

    <!-- Image / Thumbnail / Icon Area -->
    <div
      class="flex-grow-1 mx-2 mb-2 rounded overflow-hidden position-relative"
      :class="isSelected ? 'bg-primary-darken-1' : 'bg-surface'"
    >
      <!-- Image/Thumbnail -->
      <v-img
        v-if="
          item.metadata.fileType === 'image' ||
          item.metadata.thumbnail ||
          item.metadata.thumbnailBlobId
        "
        :src="thumbnailSrc"
        cover
        class="h-100 w-100"
      >
        <template #error>
          <div class="d-flex align-center justify-center h-100 w-100">
            <v-icon :icon="getFileIcon(item.metadata.fileType)" size="64" color="grey"></v-icon>
          </div>
        </template>
      </v-img>

      <!-- Icon for other types -->
      <div v-else class="d-flex align-center justify-center h-100 w-100">
        <v-icon
          :icon="getFileIcon(item.metadata.fileType)"
          size="64"
          :color="isSelected ? 'white' : item.metadata.fileType === 'pdf' ? 'red' : 'grey'"
        ></v-icon>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import type { FileItem, ClipboardItem } from '@/types/common'
import { useThumbnail } from '@/composables/useThumbnail'

const props = defineProps<{
  item: FileItem
  isSelected: boolean
  isCut: boolean
  isDragging?: boolean
  clipboard?: ClipboardItem<FileItem>[]
  selectedItems?: Set<string>
}>()

defineEmits<{
  (e: 'edit', item: FileItem): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete', item: FileItem): void
  (e: 'menu-click', item: FileItem, event: MouseEvent): void
}>()

const { thumbnailSrc } = useThumbnail(props.item)

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case 'image':
      return 'mdi-image'
    case 'video':
      return 'mdi-file-video'
    case 'pdf':
      return 'mdi-file-pdf-box'
    default:
      return 'mdi-file'
  }
}
</script>

<style scoped>
.item-cut {
  opacity: 0.5;
}

.file-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.is-dragging {
  opacity: 0.4 !important;
}
</style>
