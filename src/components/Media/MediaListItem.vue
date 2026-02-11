<template>
  <div
    class="media-item-wrapper"
    :class="{ 'pa-2': isVirtual }"
    :style="{ width: `${size}px` }"
    :data-id="item.id"
  >
    <MediaItem
      :item="item"
      :is-selected="isSelected"
      :is-focused="isFocused"
      :is-cut="isCut"
      :is-dragging="isDragging"
      :draggable="draggable"
      :size="size"
      @dragstart="emit('dragstart', $event)"
      @dragend="emit('dragend', $event)"
      @drop="emit('drop', $event)"
      @dragover="emit('dragover', $event)"
      @dragenter="emit('dragenter', $event)"
      @dragleave="emit('dragleave', $event)"
      @click.stop="emit('click', $event)"
      @dblclick="emit('dblclick')"
      @contextmenu.stop.prevent="emit('contextmenu', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { FileItem, Folder } from '@/types/folder'
import MediaItem from './MediaItem.vue'

type UnifiedItem = FileItem | Folder<FileItem>

defineProps<{
  item: UnifiedItem
  isSelected: boolean
  isFocused: boolean
  isCut: boolean
  isDragging: boolean
  draggable: boolean
  size: number
  isVirtual?: boolean
}>()

const emit = defineEmits<{
  (e: 'dragstart', event: DragEvent): void
  (e: 'dragend', event: DragEvent): void
  (e: 'drop', event: DragEvent): void
  (e: 'dragover', event: DragEvent): void
  (e: 'dragenter', event: DragEvent): void
  (e: 'dragleave', event: DragEvent): void
  (e: 'click', event: MouseEvent): void
  (e: 'dblclick'): void
  (e: 'contextmenu', event: MouseEvent): void
}>()
</script>
