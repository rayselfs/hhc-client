<template>
  <v-card
    variant="flat"
    :color="isSelected ? 'primary' : undefined"
    :ripple="false"
    class="folder-item my-1 user-select-none transition-swing rounded-lg"
    :class="[{ 'item-cut': isCut }, { 'is-dragging': isDragging }]"
    :data-id="item.id"
  >
    <div class="d-flex align-center px-3 py-2 w-100 overflow-hidden">
      <v-icon icon="mdi-folder" class="mr-3 flex-shrink-0"></v-icon>
      <span class="text-truncate flex-grow-1" style="min-width: 0" :title="item.name">{{
        item.name
      }}</span>
      <v-btn
        icon="mdi-dots-vertical"
        variant="text"
        density="compact"
        size="small"
        class="folder-context-menu-btn flex-shrink-0"
        @click.stop="$emit('menu-click', item, $event)"
      ></v-btn>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import type { Folder, FileItem } from '@/types/common'

defineProps<{
  item: Folder<FileItem>
  isSelected: boolean
  isCut: boolean
  isDragging?: boolean
}>()

defineEmits<{
  (e: 'menu-click', item: Folder<FileItem>, event: MouseEvent): void
}>()
</script>

<style scoped>
.item-cut {
  opacity: 0.5;
}

.folder-item {
  cursor: pointer;
  transition: all 0.1s ease;
  border: 1px solid transparent;
  width: 100%;
}

.is-dragging {
  opacity: 0.4 !important;
}

:global(.folder-item.drag-over) {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
}
</style>
