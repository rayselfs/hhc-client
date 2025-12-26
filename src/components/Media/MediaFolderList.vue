<template>
  <div v-if="folders.length > 0" class="mb-6">
    <v-row dense>
      <v-col
        v-for="folder in folders"
        :key="folder.id"
        cols="12"
        sm="6"
        md="4"
        lg="2"
        draggable="true"
        @dragstart="onDragStart($event, folder)"
        @drop="onDrop($event, folder)"
        @dragover.prevent
      >
        <div
          class="rounded-lg mb-2 folder-item mx-1 user-select-none"
          style="max-width: 100%"
          :class="[
            selectedItems.has(folder.id) ? 'bg-primary' : 'bg-grey-darken-4 hover-bg-grey-darken-2',
            { 'item-cut': isCut(folder.id) },
          ]"
          :data-id="folder.id"
          @click.stop="handleSelection(folder.id, $event)"
          @dblclick="openFolder(folder.id)"
          @contextmenu.prevent="openContextMenu(folder, $event)"
        >
          <div class="d-flex align-center pa-3 w-100 overflow-hidden">
            <v-icon icon="mdi-folder" color="grey-darken-1" class="mr-3 flex-shrink-0"></v-icon>
            <span
              class="text-truncate font-weight-medium flex-grow-1"
              style="min-width: 0"
              :title="folder.name"
              >{{ folder.name }}</span
            >
            <v-btn
              icon="mdi-dots-vertical"
              variant="text"
              density="compact"
              size="small"
              class="folder-context-menu-btn flex-shrink-0"
              @click.stop="openContextMenu(folder, $event)"
            ></v-btn>
          </div>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import type { Folder, FileItem, ClipboardItem } from '@/types/common'

const props = defineProps<{
  folders: Folder<FileItem>[]
  selectedItems: Set<string>
  clipboard: ClipboardItem<FileItem>[]
}>()

const emit = defineEmits<{
  (e: 'drag-start', event: DragEvent, folder: Folder<FileItem>): void
  (e: 'drop', event: DragEvent, folder: Folder<FileItem>): void
  (e: 'select', id: string, event: MouseEvent): void
  (e: 'open', id: string): void
  (e: 'context-menu', folder: Folder<FileItem>, event: MouseEvent): void
}>()

const isCut = (id: string) => {
  return props.clipboard.some((item) => item.action === 'cut' && item.data.id === id)
}

const onDragStart = (event: DragEvent, folder: Folder<FileItem>) => {
  emit('drag-start', event, folder)
}

const onDrop = (event: DragEvent, folder: Folder<FileItem>) => {
  emit('drop', event, folder)
}

const handleSelection = (id: string, event: MouseEvent) => {
  emit('select', id, event)
}

const openFolder = (id: string) => {
  emit('open', id)
}

const openContextMenu = (folder: Folder<FileItem>, event: MouseEvent) => {
  emit('context-menu', folder, event)
}
</script>

<style scoped>
.hover-bg-grey-darken-2:hover {
  background-color: rgb(var(--v-theme-grey-darken-2)) !important;
}

.item-cut {
  opacity: 0.5;
}

.folder-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.folder-item:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
}
</style>
