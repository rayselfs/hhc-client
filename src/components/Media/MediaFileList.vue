<template>
  <div v-if="items.length > 0" class="mb-1 h-100">
    <v-virtual-scroll :items="chunkedItems" class="h-100 overflow-y-auto">
      <template #default="{ item: rowItems }">
        <v-row dense class="ma-0">
          <v-col v-for="item in rowItems" :key="item.id" cols="12" sm="6" md="4" lg="2">
            <MediaFileItem
              :item="item"
              :is-selected="selectedItems.has(item.id)"
              :is-cut="isCut(item.id)"
              :draggable="canMove(item)"
              @dragstart="canMove(item) && onDragStart($event, item)"
              @dragend="emit('drag-end', $event)"
              @drop="onDrop($event, item)"
              @dragover.prevent
              @click.stop="handleSelection(item.id, $event)"
              @dblclick="previewFile(item)"
              @contextmenu.prevent="openContextMenu(item, $event)"
              @edit="emit('edit', item)"
              @copy="emit('copy')"
              @cut="emit('cut')"
              @delete="emit('delete', item)"
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
import type { FileItem, ClipboardItem, ItemPermissions } from '@/types/common'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import MediaFileItem from './MediaFileItem.vue'

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
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete', item: FileItem): void
}>()

const { name: breakpointName } = useDisplay()

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
  const chunks: FileItem[][] = []
  const items = props.items
  const size = colsPerRow.value

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
})

const getPermissions = (item: FileItem): ItemPermissions => {
  return item.permissions || DEFAULT_LOCAL_PERMISSIONS
}

const canMove = (item: FileItem) => getPermissions(item).canMove

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
</script>

<style scoped>
/* Ensure virtual scroll takes full height */
:deep(.v-virtual-scroll__container) {
  display: block !important;
}
</style>
