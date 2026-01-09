<template>
  <div v-if="combinedItems.length > 0" class="h-100">
    <v-virtual-scroll :items="chunkedItems" class="h-100 overflow-y-auto">
      <template #default="{ item: rowItems }">
        <v-row dense>
          <v-col
            v-for="item in rowItems"
            :key="item.id"
            cols="12"
            sm="6"
            md="4"
            lg="2"
            class="pa-2"
          >
            <!-- Folder Item -->
            <MediaFolderItem
              v-if="isFolder(item)"
              :item="item"
              :is-selected="selectedItems.has(item.id)"
              :is-cut="isCut(item.id)"
              :is-dragging="draggedItems.has(item.id)"
              :draggable="canMove(item)"
              @dragstart="canMove(item) && onDragStart($event, item, 'folder')"
              @dragend="onDragEnd"
              @drop="onDrop($event, item)"
              @dragover="onDragOver"
              @dragenter="onDragEnter"
              @dragleave="onDragLeave"
              @click.stop="handleSelection(item.id, $event)"
              @dblclick="openFolder(item.id)"
              @contextmenu.prevent="openContextMenu(item, $event)"
              @menu-click="(i, e) => emit('folder-menu-click', i, e)"
            />

            <!-- File Item -->
            <MediaFileItem
              v-else
              :item="item"
              :is-selected="selectedItems.has(item.id)"
              :is-cut="isCut(item.id)"
              :is-dragging="draggedItems.has(item.id)"
              :draggable="canMove(item)"
              @dragstart="canMove(item) && onDragStart($event, item, 'file')"
              @dragend="onDragEnd"
              @drop="onDrop($event, item)"
              @dragover.prevent
              @click.stop="handleSelection(item.id, $event)"
              @dblclick="previewFile(item)"
              @contextmenu.prevent="openContextMenu(item, $event)"
              @menu-click="(i, e) => emit('file-menu-click', i, e)"
            />
          </v-col>
        </v-row>
      </template>
    </v-virtual-scroll>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import type { FileItem, Folder, ClipboardItem, ItemPermissions } from '@/types/common'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import MediaFileItem from './MediaFileItem.vue'
import MediaFolderItem from './MediaFolderItem.vue'
import { useDragAndDrop } from '@/composables/useDragAndDrop'

type UnifiedItem = FileItem | Folder<FileItem>

const props = defineProps<{
  folders: Folder<FileItem>[]
  files: FileItem[]
  selectedItems: Set<string>
  clipboard: ClipboardItem<FileItem>[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  (e: 'drag-start', event: DragEvent, item: UnifiedItem): void
  (e: 'drag-end', event: DragEvent): void
  (e: 'drop', event: DragEvent, item: UnifiedItem): void
  (e: 'selection-change', id: string, event: MouseEvent): void
  (e: 'folder-click', id: string): void
  (e: 'file-click', item: FileItem): void
  (e: 'folder-menu-click', folder: Folder<FileItem>, event: MouseEvent): void
  (e: 'file-menu-click', item: FileItem, event: MouseEvent): void
}>()

const { name: breakpointName } = useDisplay()

// Helper to check type
const isFolder = (item: UnifiedItem): item is Folder<FileItem> => {
  return 'children' in item || !('metadata' in item)
}

const combinedItems = computed(() => {
  return [...props.folders, ...props.files]
})

// Drag and Drop
const {
  handleDragStart,
  handleDragEnd,
  handleDrop,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  draggedItems,
} = useDragAndDrop<FileItem>({
  itemSelector: '.folder-item, .file-item',
})

const onDragOver = (event: DragEvent) => {
  handleDragOver(event)
}

const onDragEnter = (event: DragEvent) => {
  handleDragEnter(event)
}

const onDragLeave = (event: DragEvent) => {
  handleDragLeave(event)
}

// Calculate columns per row based on current breakpoint
const colsPerRow = computed(() => {
  switch (breakpointName.value) {
    case 'xs':
      return 1
    case 'sm':
      return 2
    case 'md':
      return 3
    case 'lg':
    case 'xl':
    case 'xxl':
      return 6
    default:
      return 6
  }
})

// Group items into chunks for VVirtualScroll rows
const chunkedItems = computed(() => {
  const chunks: UnifiedItem[][] = []
  const size = colsPerRow.value

  // Chunk folders first
  const folderItems = props.folders
  for (let i = 0; i < folderItems.length; i += size) {
    chunks.push(folderItems.slice(i, i + size))
  }

  // Chunk files separately to ensure they start on a new row
  const fileItems = props.files
  for (let i = 0; i < fileItems.length; i += size) {
    chunks.push(fileItems.slice(i, i + size))
  }

  return chunks
})

const getPermissions = (item: UnifiedItem): ItemPermissions => {
  return item.permissions || DEFAULT_LOCAL_PERMISSIONS
}

const canMove = (item: UnifiedItem) => getPermissions(item).canMove

const isCut = (id: string) => {
  return props.clipboard.some((item) => item.action === 'cut' && item.data.id === id)
}

const onDragStart = (event: DragEvent, item: UnifiedItem, type: 'folder' | 'file') => {
  handleDragStart(event, type, item, props.selectedItems, () =>
    combinedItems.value.filter((i) => props.selectedItems.has(i.id)),
  )
  emit('drag-start', event, item)
}

const onDragEnd = (event: DragEvent) => {
  handleDragEnd()
  emit('drag-end', event)
}

const onDrop = (event: DragEvent, item: UnifiedItem) => {
  // Only folders accept drops
  if (isFolder(item)) {
    handleDrop(event, () => {
      emit('drop', event, item)
    })
  }
}

const handleSelection = (id: string, event: MouseEvent) => {
  emit('selection-change', id, event)
}

const openFolder = (id: string) => {
  emit('folder-click', id)
}

const previewFile = (item: FileItem) => {
  emit('file-click', item)
}

const openContextMenu = (item: UnifiedItem, event: MouseEvent) => {
  if (isFolder(item)) {
    emit('folder-menu-click', item, event)
  } else {
    emit('file-menu-click', item as FileItem, event)
  }
}
</script>

<style scoped>
/* Ensure virtual scroll takes full height */
:deep(.v-virtual-scroll__container) {
  display: block !important;
}
</style>
