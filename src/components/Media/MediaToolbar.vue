<template>
  <div class="media-toolbar-overlay">
    <ContextMenu
      v-model="internalShow"
      :activator="activator"
      :position="position"
      close-on-content-click
      raw
    >
      <MediaItemContextMenu
        v-if="contextMenuTarget"
        :target="contextMenuTarget"
        :is-folder="isFolder(contextMenuTarget)"
        :clipboard="clipboard"
        :selected-items="selectedItems"
        @edit="(target) => emit('edit', target)"
        @copy="emit('copy')"
        @cut="emit('cut')"
        @delete="emit('delete')"
        @paste-into-folder="(id) => emit('paste-into-folder', id)"
      />
      <MediaBackgroundMenu
        v-else
        :clipboard="clipboard"
        @create-folder="emit('create-folder')"
        @upload-file="emit('upload-file')"
        @upload-folder="emit('upload-folder')"
        @paste="emit('paste')"
      />
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem, Folder, ClipboardItem } from '@/types/common'
import ContextMenu from '@/components/ContextMenu.vue'
import MediaItemContextMenu from './MediaItemContextMenu.vue'
import MediaBackgroundMenu from './MediaBackgroundMenu.vue'

type UnifiedItem = FileItem | Folder<FileItem>

const props = defineProps<{
  modelValue: boolean
  activator?: HTMLElement
  position?: [number, number]
  contextMenuTarget: UnifiedItem | null
  clipboard: ClipboardItem<FileItem>[]
  selectedItems: Set<string>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit', target: UnifiedItem): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete'): void
  (e: 'paste'): void
  (e: 'create-folder'): void
  (e: 'upload-file'): void
  (e: 'upload-folder'): void
  (e: 'paste-into-folder', folderId: string): void
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isFolder = (item: UnifiedItem): item is Folder<FileItem> => {
  return 'items' in item
}
</script>
