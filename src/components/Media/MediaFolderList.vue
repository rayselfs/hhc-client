<template>
  <div v-if="folders.length > 0" class="mb-6">
    <v-row dense>
      <v-col v-for="folder in folders" :key="folder.id" cols="12" sm="6" md="4" lg="2">
        <v-card
          variant="flat"
          :color="selectedItems.has(folder.id) ? 'primary' : undefined"
          :ripple="false"
          class="mb-2 folder-item mx-1 user-select-none transition-swing rounded-lg"
          :class="[
            { 'item-cut': isCut(folder.id) },
            { 'is-dragging': draggedItems.has(folder.id) },
          ]"
          :data-id="folder.id"
          :draggable="canMove(folder)"
          @dragstart="canMove(folder) && onDragStart($event, folder)"
          @dragend="handleDragEnd"
          @drop="onDrop($event, folder)"
          @dragover="onDragOver"
          @dragenter="onDragEnter"
          @dragleave="onDragLeave"
          @click.stop="handleSelection(folder.id, $event)"
          @dblclick="openFolder(folder.id)"
          @contextmenu.prevent="openContextMenu(folder, $event)"
        >
          <div class="d-flex align-center pa-3 w-100 overflow-hidden">
            <v-icon icon="mdi-folder" class="mr-3 flex-shrink-0"></v-icon>
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
              @click.stop="emit('menu-click', folder, $event)"
            ></v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import type { Folder, FileItem, ClipboardItem, ItemPermissions } from '@/types/common'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import { useDragAndDrop } from '@/composables/useDragAndDrop'

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
  (e: 'menu-click', folder: Folder<FileItem>, event: MouseEvent): void
}>()

const getPermissions = (folder: Folder<FileItem>): ItemPermissions => {
  return folder.permissions || DEFAULT_LOCAL_PERMISSIONS
}

const canMove = (folder: Folder<FileItem>) => getPermissions(folder).canMove

const isCut = (id: string) => {
  return props.clipboard.some((item) => item.action === 'cut' && item.data.id === id)
}

// Drag and Drop
const {
  handleDragStart,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  draggedItems,
} = useDragAndDrop<FileItem>({
  itemSelector: '.folder-item',
})

const onDragStart = (event: DragEvent, folder: Folder<FileItem>) => {
  handleDragStart(event, 'folder', folder)
}

const onDragOver = (event: DragEvent) => {
  handleDragOver(event)
}

const onDragEnter = (event: DragEvent) => {
  handleDragEnter(event)
}

const onDragLeave = (event: DragEvent) => {
  handleDragLeave(event)
}

const onDrop = (event: DragEvent, folder: Folder<FileItem>) => {
  handleDrop(event, () => {
    emit('drop', event, folder)
  })
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
.item-cut {
  opacity: 0.5;
}

.folder-item {
  cursor: pointer;
  transition: all 0.1s ease;
  border: 1px solid transparent;
}

.is-dragging {
  opacity: 0.4 !important;
}

.drag-over {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
}
</style>
