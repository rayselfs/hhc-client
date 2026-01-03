<template>
  <div v-if="items.length > 0" class="mb-1">
    <v-row dense>
      <v-col
        v-for="item in items"
        :key="item.id"
        cols="12"
        sm="6"
        md="4"
        lg="2"
        draggable="true"
        @dragstart="onDragStart($event, item)"
        @dragend="emit('drag-end', $event)"
        @drop="onDrop($event, item)"
        @dragover.prevent
      >
        <div
          class="rounded-lg file-item user-select-none d-flex flex-column h-100 position-relative"
          style="aspect-ratio: 1; max-width: 100%"
          :class="[
            selectedItems.has(item.id) ? 'bg-primary' : 'bg-grey-darken-4 hover-bg-grey-darken-2',
            { 'item-cut': isCut(item.id) },
          ]"
          :data-id="item.id"
          @click.stop="handleSelection(item.id, $event)"
          @dblclick="previewFile(item)"
          @contextmenu.prevent="openContextMenu(item, $event)"
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
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical"
                  variant="text"
                  density="compact"
                  size="small"
                  v-bind="props"
                  @click.stop
                ></v-btn>
              </template>
              <v-list width="150" density="compact" class="rounded-lg elevation-2">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  :title="$t('common.edit')"
                  @click="emit('edit', item)"
                ></v-list-item>
                <v-list-item
                  prepend-icon="mdi-folder-move-outline"
                  :title="$t('common.move')"
                  @click="emit('move', item)"
                ></v-list-item>
                <v-list-item
                  prepend-icon="mdi-content-copy"
                  :title="$t('common.copy')"
                  @click="emit('copy')"
                ></v-list-item>
                <v-list-item
                  prepend-icon="mdi-content-cut"
                  :title="$t('common.cut')"
                  @click="emit('cut')"
                ></v-list-item>
                <v-list-item
                  prepend-icon="mdi-delete-outline"
                  :title="$t('common.delete')"
                  color="error"
                  @click="emit('delete', item)"
                ></v-list-item>
              </v-list>
            </v-menu>
          </div>

          <!-- Image / Thumbnail / Icon Area -->
          <div
            class="flex-grow-1 mx-2 mb-2 rounded overflow-hidden position-relative bg-grey-darken-3"
          >
            <!-- Image/Thumbnail -->
            <v-img
              v-if="item.metadata.fileType === 'image' || item.metadata.thumbnail"
              :src="item.metadata.thumbnail || item.url"
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
                  <v-icon
                    :icon="getFileIcon(item.metadata.fileType)"
                    size="64"
                    color="grey"
                  ></v-icon>
                </div>
              </template>
            </v-img>

            <!-- Icon for other types (Video without thumbnail, PDF) -->
            <div v-else class="d-flex align-center justify-center h-100 w-100">
              <v-icon
                :icon="getFileIcon(item.metadata.fileType)"
                size="64"
                :color="item.metadata.fileType === 'pdf' ? 'red' : 'grey'"
              ></v-icon>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import type { FileItem, ClipboardItem } from '@/types/common'

const props = defineProps<{
  items: FileItem[]
  selectedItems: Set<string>
  clipboard: ClipboardItem<FileItem>[]
}>()

const emit = defineEmits<{
  (e: 'drag-start', event: DragEvent, item: FileItem): void
  (e: 'drag-end', event: DragEvent): void
  (e: 'drop', event: DragEvent, item: FileItem): void
  (e: 'select', id: string, event: MouseEvent): void
  (e: 'preview', item: FileItem): void
  (e: 'context-menu', item: FileItem, event: MouseEvent): void
  (e: 'edit', item: FileItem): void
  (e: 'move', item: FileItem): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete', item: FileItem): void
}>()

const isCut = (id: string) => {
  return props.clipboard.some((item) => item.action === 'cut' && item.data.id === id)
}

const onDragStart = (event: DragEvent, item: FileItem) => {
  emit('drag-start', event, item)
}

const onDrop = (event: DragEvent, item: FileItem) => {
  emit('drop', event, item)
}

const handleSelection = (id: string, event: MouseEvent) => {
  emit('select', id, event)
}

const previewFile = (item: FileItem) => {
  emit('preview', item)
}

const openContextMenu = (item: FileItem, event: MouseEvent) => {
  emit('context-menu', item, event)
}

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
