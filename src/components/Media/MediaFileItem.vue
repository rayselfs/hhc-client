<template>
  <div
    class="rounded-lg file-item user-select-none d-flex flex-column h-100 position-relative"
    style="aspect-ratio: 1; max-width: 100%"
    :class="[
      isSelected ? 'bg-primary' : 'bg-grey-darken-4 hover-bg-grey-darken-2',
      { 'item-cut': isCut },
    ]"
    :data-id="item.id"
  >
    <!-- Header Info -->
    <div class="d-flex align-center px-3 pt-2 pb-1 w-100 overflow-hidden">
      <v-icon
        :icon="getFileIcon(item.metadata.fileType)"
        color="red"
        size="small"
        class="mr-2 flex-shrink-0"
      ></v-icon>
      <span
        class="py-2 text-body-2 text-truncate flex-grow-1"
        style="min-width: 0"
        :title="item.name"
        >{{ item.name }}</span
      >
      <v-btn
        icon="mdi-dots-vertical"
        variant="text"
        density="compact"
        size="small"
        class="flex-shrink-0"
        @click.stop="$emit('menu-click', item, $event)"
      ></v-btn>
    </div>

    <!-- Image / Thumbnail / Icon Area -->
    <div class="flex-grow-1 mx-2 mb-2 rounded overflow-hidden position-relative bg-grey-darken-3">
      <!-- Image/Thumbnail -->
      <v-img
        v-if="
          item.metadata.fileType === 'image' ||
          item.metadata.thumbnail ||
          item.metadata.thumbnailBlobId
        "
        :src="thumbnailSrc"
        cover
        class="h-100 w-100 bg-grey-darken-3"
      >
        <!-- Type Indicator for Video -->
        <div
          v-if="item.metadata.fileType === 'video'"
          class="d-flex justify-end pa-2 w-100 h-100 align-end"
        >
          <v-btn
            icon="mdi-play-circle"
            variant="text"
            color="white"
            size="small"
            class="bg-black-alpha-50 rounded-circle"
          ></v-btn>
        </div>

        <template #error>
          <div class="d-flex align-center justify-center h-100 w-100 bg-grey-darken-3">
            <v-icon :icon="getFileIcon(item.metadata.fileType)" size="64" color="grey"></v-icon>
          </div>
        </template>
      </v-img>

      <!-- Icon for other types -->
      <div v-else class="d-flex align-center justify-center h-100 w-100">
        <v-icon
          :icon="getFileIcon(item.metadata.fileType)"
          size="64"
          :color="item.metadata.fileType === 'pdf' ? 'red' : 'grey'"
        ></v-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileItem, ClipboardItem } from '@/types/common'
import { useThumbnail } from '@/composables/useThumbnail'

const props = defineProps<{
  item: FileItem
  isSelected: boolean
  isCut: boolean
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
.hover-bg-grey-darken-2:hover {
  background-color: rgb(var(--v-theme-grey-darken-2)) !important;
}

.item-cut {
  opacity: 0.5;
}

.file-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.file-item:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.bg-black-alpha-50 {
  background-color: rgba(0, 0, 0, 0.5);
}
</style>
